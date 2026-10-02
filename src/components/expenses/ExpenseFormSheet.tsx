import { ButtonHTMLAttributes, FormEvent, ReactNode, forwardRef, useEffect, useRef, useState } from "react";
import { format, isSameDay, subDays } from "date-fns";
import { CalendarIcon, Check, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CategorySelector } from "@/components/CategorySelector";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { errorMessage, formatMoney, parseDay } from "@/lib/format";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export interface EditableExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  expense_splits: { flatmate_id: string }[];
}

interface Flatmate {
  id: string;
  name: string;
}

interface ExpenseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditableExpense | null;
  onSaved: () => void;
}

// Columns added by later migrations that the generated types don't include yet.
type ExpenseExtras = { category_id: string | null; split_space_id?: string };

const lastPayerKey = (spaceId?: string) => `lastPaidBy:${spaceId ?? "none"}`;

const emptyForm = () => ({
  title: "",
  amount: "",
  date: new Date(),
  paidBy: "",
  splitBetween: [] as string[],
  categoryId: "",
});

export const ExpenseFormSheet = ({ open, onOpenChange, editing, onSaved }: ExpenseFormSheetProps) => {
  const isMobile = useIsMobile();
  const title = editing ? "Edit expense" : "Add expense";
  const description = editing
    ? "Change the details or who it's split between."
    : "Who paid, how much, and who shares it.";

  const body = (
    <ExpenseForm
      key={`${open}-${editing?.id ?? "new"}`}
      editing={editing}
      onDone={() => onOpenChange(false)}
      onSaved={onSaved}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[94dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open && body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && body}
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint}
    </div>
    {children}
  </div>
);

const Chip = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }
>(({ selected, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={selected}
    className={cn(
      "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected
        ? "border-primary bg-primary/10 font-medium text-foreground"
        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
Chip.displayName = "Chip";

const ExpenseForm = ({
  editing,
  onDone,
  onSaved,
}: {
  editing: EditableExpense | null;
  onDone: () => void;
  onSaved: () => void;
}) => {
  const { selectedSplitSpace } = useSplitSpace();
  const navigate = useNavigate();
  const amountRef = useRef<HTMLInputElement>(null);
  const [flatmates, setFlatmates] = useState<Flatmate[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState<"close" | "again" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let q = supabase.from("flatmates").select("id, name").order("name");
      if (selectedSplitSpace) {
        q = q.or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load people");
        setFlatmates([]);
        return;
      }
      const people = data || [];
      setFlatmates(people);

      if (editing) {
        setForm({
          title: editing.title,
          amount: String(editing.amount),
          date: parseDay(editing.date),
          paidBy: editing.paid_by,
          splitBetween: editing.expense_splits.map((s) => s.flatmate_id),
          categoryId: editing.category_id || "",
        });
      } else {
        const remembered = localStorage.getItem(lastPayerKey(selectedSplitSpace?.id));
        setForm((f) => ({
          ...f,
          paidBy: people.some((p) => p.id === remembered) ? remembered! : people.length === 1 ? people[0].id : "",
          splitBetween: people.map((p) => p.id),
        }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editing, selectedSplitSpace]);

  useEffect(() => {
    if (flatmates && !editing) amountRef.current?.focus();
  }, [flatmates, editing]);

  const amount = parseFloat(form.amount);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const splitCount = form.splitBetween.length;
  const perPerson = validAmount && splitCount > 0 ? amount / splitCount : 0;
  const allSelected = !!flatmates && flatmates.length > 0 && splitCount === flatmates.length;

  const missing = [
    !validAmount && "an amount",
    !form.title.trim() && "a description",
    !form.paidBy && "who paid",
    splitCount === 0 && "who it's split between",
  ].filter(Boolean) as string[];

  const toggleSplit = (id: string) =>
    setForm((f) => ({
      ...f,
      splitBetween: f.splitBetween.includes(id)
        ? f.splitBetween.filter((x) => x !== id)
        : [...f.splitBetween, id],
    }));

  const save = async (mode: "close" | "again") => {
    setTriedSubmit(true);
    if (missing.length > 0) return;

    setSubmitting(mode);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editing) {
        const changes: TablesUpdate<"expenses"> & ExpenseExtras = {
          title: form.title.trim(),
          amount,
          date: format(form.date, "yyyy-MM-dd"),
          paid_by: form.paidBy,
          category_id: form.categoryId || null,
        };
        const { error: expenseError } = await supabase
          .from("expenses")
          .update(changes)
          .eq("id", editing.id);
        if (expenseError) throw expenseError;

        await supabase.from("expense_splits").delete().eq("expense_id", editing.id);

        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: editing.id,
            flatmate_id: flatmateId,
          }))
        );
        if (splitsError) throw splitsError;
        toast.success("Expense updated");
      } else {
        const expenseDataToInsert: TablesInsert<"expenses"> & ExpenseExtras = {
          title: form.title.trim(),
          amount,
          date: format(form.date, "yyyy-MM-dd"),
          paid_by: form.paidBy,
          created_by: user.id,
          category_id: form.categoryId || null,
        };
        if (selectedSplitSpace) {
          expenseDataToInsert.split_space_id = selectedSplitSpace.id;
        }

        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .insert(expenseDataToInsert)
          .select()
          .single();
        if (expenseError) throw expenseError;

        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: expenseData.id,
            flatmate_id: flatmateId,
          }))
        );
        if (splitsError) throw splitsError;

        localStorage.setItem(lastPayerKey(selectedSplitSpace?.id), form.paidBy);
        toast.success(`Added “${form.title.trim()}” · ${formatMoney(amount)}`);
      }

      onSaved();
      if (mode === "again" && !editing) {
        // Keep payer, split, date and category — clear what changes per receipt.
        setForm((f) => ({ ...f, title: "", amount: "" }));
        setTriedSubmit(false);
        amountRef.current?.focus();
      } else {
        onDone();
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save expense"));
      console.error(error);
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const { error } = await supabase.from("expenses").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted");
    onSaved();
    onDone();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save("close");
  };

  if (flatmates === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (flatmates.length === 0) {
    return (
      <div className="space-y-4 py-6 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Add the people you share costs with before logging an expense.
        </p>
        <Button
          onClick={() => {
            onDone();
            navigate("/dashboard#people");
          }}
        >
          Add people
        </Button>
      </div>
    );
  }

  const today = new Date();
  const yesterday = subDays(today, 1);
  const isCustomDate = !isSameDay(form.date, today) && !isSameDay(form.date, yesterday);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Amount + description: the two things you always type */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
              ₹
            </span>
            <Input
              ref={amountRef}
              id="expense-amount"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              aria-invalid={triedSubmit && !validAmount}
              className={cn(
                "h-12 pl-8 text-lg font-semibold tabular-nums",
                triedSubmit && !validAmount && "border-destructive"
              )}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-title">What for?</Label>
          <Input
            id="expense-title"
            placeholder="Groceries, rent, Wi‑Fi…"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            aria-invalid={triedSubmit && !form.title.trim()}
            className={cn("h-12", triedSubmit && !form.title.trim() && "border-destructive")}
          />
        </div>
      </div>

      <Field label="Paid by">
        <div
          role="radiogroup"
          className={cn(
            "flex flex-wrap gap-2 rounded-lg",
            triedSubmit && !form.paidBy && "ring-1 ring-destructive ring-offset-4 ring-offset-card"
          )}
        >
          {flatmates.map((f) => (
            <Chip
              key={f.id}
              selected={form.paidBy === f.id}
              onClick={() => setForm({ ...form, paidBy: f.id })}
            >
              <PersonAvatar name={f.name} size="xs" />
              {f.name}
            </Chip>
          ))}
        </div>
      </Field>

      <Field
        label="Split equally between"
        hint={
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() =>
              setForm({ ...form, splitBetween: allSelected ? [] : flatmates.map((f) => f.id) })
            }
          >
            {allSelected ? "Clear" : "Everyone"}
          </button>
        }
      >
        <div
          className={cn(
            "flex flex-wrap gap-2 rounded-lg",
            triedSubmit && splitCount === 0 && "ring-1 ring-destructive ring-offset-4 ring-offset-card"
          )}
        >
          {flatmates.map((f) => {
            const on = form.splitBetween.includes(f.id);
            return (
              <Chip key={f.id} selected={on} onClick={() => toggleSplit(f.id)}>
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                {f.name}
              </Chip>
            );
          })}
        </div>
        <div className="rounded-lg bg-secondary/60 px-3 py-2.5 text-sm" aria-live="polite">
          {splitCount === 0 ? (
            <span className="text-muted-foreground">Pick at least one person.</span>
          ) : validAmount ? (
            <span>
              <span className="font-semibold tabular-nums">{formatMoney(perPerson)}</span>
              <span className="text-muted-foreground">
                {" "}
                each · {splitCount} {splitCount === 1 ? "person" : "people"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Split {splitCount} {splitCount === 1 ? "way" : "ways"} — enter an amount to see each share.
            </span>
          )}
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date">
          <div className="flex flex-wrap gap-2">
            <Chip selected={isSameDay(form.date, today)} onClick={() => setForm({ ...form, date: today })}>
              Today
            </Chip>
            <Chip
              selected={isSameDay(form.date, yesterday)}
              onClick={() => setForm({ ...form, date: yesterday })}
            >
              Yesterday
            </Chip>
            <Popover>
              <PopoverTrigger asChild>
                <Chip selected={isCustomDate}>
                  <CalendarIcon className="h-4 w-4" />
                  {isCustomDate ? format(form.date, "d MMM") : "Pick"}
                </Chip>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.date}
                  onSelect={(date) => date && setForm({ ...form, date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </Field>

        <Field label="Category">
          <CategorySelector
            value={form.categoryId}
            onValueChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}
            splitSpaceId={selectedSplitSpace?.id}
          />
        </Field>
      </div>

      <div className="space-y-2 border-t pt-4">
        {triedSubmit && missing.length > 0 && (
          <p className="text-sm text-destructive" role="alert">
            Still needed: {missing.join(", ")}.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={!!submitting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="sm:mr-auto"
              onClick={() => save("again")}
              disabled={!!submitting}
            >
              {submitting === "again" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & add another
            </Button>
          )}
          <Button type="submit" size="lg" className="sm:min-w-40" disabled={!!submitting}>
            {submitting === "close" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing
              ? "Save changes"
              : validAmount
              ? `Add ${formatMoney(amount)}`
              : "Add expense"}
          </Button>
        </div>
      </div>

      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this expense?"
          description={`“${editing.title}” (${formatMoney(editing.amount)}) will be removed and everyone's balances will update.`}
          onConfirm={handleDelete}
        />
      )}
    </form>
  );
};
