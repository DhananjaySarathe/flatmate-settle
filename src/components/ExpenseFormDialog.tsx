import { useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { CalendarIcon, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CategorySelector } from "@/components/CategorySelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatMoney, parseDay } from "@/lib/format";
import { errorMessage } from "@/lib/spaceData";

interface Member {
  id: string;
  name: string;
}

export interface EditableExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  expense_splits: { flatmate_id: string }[];
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flatmates: Member[];
  splitSpaceId?: string;
  expense?: EditableExpense | null;
  onSaved: () => void;
}

interface FormState {
  title: string;
  amount: string;
  date: Date;
  paidBy: string;
  splitBetween: string[];
  categoryId: string;
}

const LAST_PAYER_KEY = "lastPaidBy";

const readLastPayer = () => {
  try {
    return localStorage.getItem(LAST_PAYER_KEY) ?? "";
  } catch {
    return "";
  }
};

const emptyForm = (flatmates: Member[]): FormState => {
  const lastPayer = readLastPayer();
  return {
    title: "",
    amount: "",
    date: new Date(),
    paidBy: flatmates.some((f) => f.id === lastPayer) ? lastPayer : flatmates.length === 1 ? flatmates[0].id : "",
    // Most shared expenses are split with everyone; start there and let people deselect.
    splitBetween: flatmates.map((f) => f.id),
    categoryId: "",
  };
};

const ChoiceChip = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
    )}
  >
    {selected && <Check className="h-3.5 w-3.5" />}
    {children}
  </button>
);

export const ExpenseFormDialog = ({
  open,
  onOpenChange,
  flatmates,
  splitSpaceId,
  expense,
  onSaved,
}: ExpenseFormDialogProps) => {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<FormState>(() => emptyForm(flatmates));
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    if (expense) {
      setForm({
        title: expense.title,
        amount: expense.amount.toString(),
        date: parseDay(expense.date),
        paidBy: expense.paid_by,
        splitBetween: expense.expense_splits.map((s) => s.flatmate_id),
        categoryId: expense.category_id || "",
      });
    } else {
      setForm(emptyForm(flatmates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const amount = parseFloat(form.amount);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const errors = {
    title: !form.title.trim() ? "Add a short description" : null,
    amount: !amountValid ? "Enter an amount above 0" : null,
    paidBy: !form.paidBy ? "Pick who paid" : null,
    split: form.splitBetween.length === 0 ? "Pick at least one person" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const share = useMemo(
    () => (amountValid && form.splitBetween.length > 0 ? amount / form.splitBetween.length : null),
    [amount, amountValid, form.splitBetween.length]
  );

  const allSelected = flatmates.length > 0 && form.splitBetween.length === flatmates.length;

  const toggleSplit = (id: string) =>
    setForm((prev) => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(id)
        ? prev.splitBetween.filter((x) => x !== id)
        : [...prev.splitBetween, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (expense) {
        const { error: expenseError } = await supabase
          .from("expenses")
          .update({
            title: form.title.trim(),
            amount,
            date: format(form.date, "yyyy-MM-dd"),
            paid_by: form.paidBy,
            category_id: form.categoryId || null,
          } as never)
          .eq("id", expense.id);
        if (expenseError) throw expenseError;

        await supabase.from("expense_splits").delete().eq("expense_id", expense.id);

        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: expense.id,
            flatmate_id: flatmateId,
          }))
        );
        if (splitsError) throw splitsError;
        toast.success("Expense updated");
      } else {
        const expenseDataToInsert: Record<string, unknown> = {
          title: form.title.trim(),
          amount,
          date: format(form.date, "yyyy-MM-dd"),
          paid_by: form.paidBy,
          created_by: user.id,
          category_id: form.categoryId || null,
        };
        if (splitSpaceId) expenseDataToInsert.split_space_id = splitSpaceId;

        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .insert(expenseDataToInsert as never)
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
        toast.success(`Added ${form.title.trim()} · ${formatMoney(amount)}`);
      }

      try {
        localStorage.setItem(LAST_PAYER_KEY, form.paidBy);
      } catch {
        // storage unavailable; remembering the payer is only a convenience
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the expense"));
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (msg: string | null) =>
    showErrors && msg ? <p className="text-xs font-medium text-destructive">{msg}</p> : null;

  const payerName = flatmates.find((f) => f.id === form.paidBy)?.name;

  const body = (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
              ₹
            </span>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus={!expense && !isMobile}
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              aria-invalid={showErrors && !!errors.amount}
              className="h-12 pl-8 text-xl font-semibold tabular-nums"
            />
          </div>
          {fieldError(errors.amount)}
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-12 justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {isToday(form.date) ? "Today" : isYesterday(form.date) ? "Yesterday" : format(form.date, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex gap-2 border-b p-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isToday(form.date) ? "default" : "outline"}
                  onClick={() => {
                    setForm((p) => ({ ...p, date: new Date() }));
                    setDateOpen(false);
                  }}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isYesterday(form.date) ? "default" : "outline"}
                  onClick={() => {
                    setForm((p) => ({ ...p, date: subDays(new Date(), 1) }));
                    setDateOpen(false);
                  }}
                >
                  Yesterday
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={form.date}
                onSelect={(date) => {
                  if (date) {
                    setForm((p) => ({ ...p, date }));
                    setDateOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense-title">What was it for?</Label>
        <Input
          id="expense-title"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Groceries, rent, electricity…"
          aria-invalid={showErrors && !!errors.title}
          className="h-11"
        />
        {fieldError(errors.title)}
      </div>

      <div className="space-y-2">
        <Label>Paid by</Label>
        <div className="flex flex-wrap gap-2">
          {flatmates.map((f) => (
            <ChoiceChip
              key={f.id}
              selected={form.paidBy === f.id}
              onClick={() => setForm((p) => ({ ...p, paidBy: f.id }))}
            >
              {f.name}
            </ChoiceChip>
          ))}
        </div>
        {fieldError(errors.paidBy)}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Split equally between</Label>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() =>
              setForm((p) => ({ ...p, splitBetween: allSelected ? [] : flatmates.map((f) => f.id) }))
            }
          >
            {allSelected ? "Clear" : "Everyone"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {flatmates.map((f) => (
            <ChoiceChip key={f.id} selected={form.splitBetween.includes(f.id)} onClick={() => toggleSplit(f.id)}>
              {f.name}
            </ChoiceChip>
          ))}
        </div>
        {fieldError(errors.split)}
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <CategorySelector
          value={form.categoryId}
          onValueChange={(value) => setForm((p) => ({ ...p, categoryId: value }))}
          splitSpaceId={splitSpaceId}
        />
      </div>

      <div className="rounded-lg bg-secondary/60 px-4 py-3 text-sm" aria-live="polite">
        {share !== null ? (
          <p>
            <span className="font-semibold tabular-nums">{formatMoney(share)}</span>{" "}
            <span className="text-muted-foreground">
              each for {form.splitBetween.length} {form.splitBetween.length === 1 ? "person" : "people"}
              {payerName ? ` · ${payerName} paid ${formatMoney(amount)}` : ""}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">Enter an amount to see each person's share.</p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : expense ? (
          "Save changes"
        ) : (
          "Add expense"
        )}
      </Button>
    </form>
  );

  const title = expense ? "Edit expense" : "Add an expense";
  const description = expense ? "Changes update everyone's balances." : "Split equally between the people you pick.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};
