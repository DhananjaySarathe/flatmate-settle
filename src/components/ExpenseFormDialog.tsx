import { useRef, useState } from "react";
import { format, isSameDay, parseISO, subDays } from "date-fns";
import { Calendar as CalendarIcon, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategorySelector } from "@/components/CategorySelector";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ExpenseFormFlatmate {
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
  flatmates: ExpenseFormFlatmate[];
  expense?: EditableExpense | null;
  onSaved: () => void;
}

const LAST_PAYER_KEY = "lastPaidBy";

const readLastPayer = (spaceId?: string) => {
  try {
    return localStorage.getItem(`${LAST_PAYER_KEY}:${spaceId ?? "none"}`) || "";
  } catch {
    return "";
  }
};

const writeLastPayer = (spaceId: string | undefined, flatmateId: string) => {
  try {
    localStorage.setItem(`${LAST_PAYER_KEY}:${spaceId ?? "none"}`, flatmateId);
  } catch {
    // Remembering the payer is a convenience only.
  }
};

interface FormState {
  title: string;
  amount: string;
  date: Date;
  paidBy: string;
  splitBetween: string[];
  categoryId: string;
}

type FormErrors = Partial<Record<"title" | "amount" | "paidBy" | "splitBetween", string>>;

export const ExpenseFormDialog = ({ open, onOpenChange, flatmates, expense, onSaved }: ExpenseFormDialogProps) => {
  // A fresh key per opening guarantees the form starts from the right values, even if
  // the previous content is still mounted for its exit animation.
  const openCount = useRef(0);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) openCount.current += 1;
  wasOpen.current = open;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("amount")?.focus();
        }}
      >
        {/* State lives in the body so it is initialised before child fields
            (like CategorySelector's default) mount. */}
        <ExpenseFormBody
          key={`${expense?.id ?? "new"}-${openCount.current}`}
          flatmates={flatmates}
          expense={expense}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
};

interface ExpenseFormBodyProps {
  flatmates: ExpenseFormFlatmate[];
  expense?: EditableExpense | null;
  onClose: () => void;
  onSaved: () => void;
}

const ExpenseFormBody = ({ flatmates, expense, onClose, onSaved }: ExpenseFormBodyProps) => {
  const { selectedSplitSpace } = useSplitSpace();
  const isEditing = !!expense;

  const [form, setForm] = useState<FormState>(() => {
    if (expense) {
      return {
        title: expense.title,
        amount: expense.amount.toString(),
        date: parseISO(expense.date),
        paidBy: expense.paid_by,
        splitBetween: expense.expense_splits.map((s) => s.flatmate_id),
        categoryId: expense.category_id || "",
      };
    }
    const lastPayer = readLastPayer(selectedSplitSpace?.id);
    return {
      title: "",
      amount: "",
      date: new Date(),
      paidBy: flatmates.some((f) => f.id === lastPayer) ? lastPayer : "",
      // Most shared expenses include everyone, so start there and let people opt out.
      splitBetween: flatmates.map((f) => f.id),
      categoryId: "",
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const amountValue = parseFloat(form.amount);
  const splitCount = form.splitBetween.length;
  const perPerson =
    Number.isFinite(amountValue) && amountValue > 0 && splitCount > 0 ? amountValue / splitCount : null;

  const allSelected = flatmates.length > 0 && splitCount === flatmates.length;

  const toggleSplit = (id: string) => {
    setErrors((e) => ({ ...e, splitBetween: undefined }));
    setForm((prev) => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(id)
        ? prev.splitBetween.filter((x) => x !== id)
        : [...prev.splitBetween, id],
    }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.title.trim()) next.title = "What was this for?";
    if (!Number.isFinite(amountValue) || amountValue <= 0) next.amount = "Enter an amount above zero";
    if (!form.paidBy) next.paidBy = "Pick who paid";
    if (splitCount === 0) next.splitBetween = "Pick at least one person";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
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
            amount: amountValue,
            date: format(form.date, "yyyy-MM-dd"),
            paid_by: form.paidBy,
            category_id: form.categoryId || null,
          })
          .eq("id", expense.id);
        if (expenseError) throw expenseError;

        await supabase.from("expense_splits").delete().eq("expense_id", expense.id);

        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: expense.id,
            flatmate_id: flatmateId,
          })),
        );
        if (splitsError) throw splitsError;
        toast.success("Expense updated");
      } else {
        const expenseDataToInsert: any = {
          title: form.title.trim(),
          amount: amountValue,
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
          })),
        );
        if (splitsError) throw splitsError;

        writeLastPayer(selectedSplitSpace?.id, form.paidBy);
        toast.success(`Added ${form.title.trim()} · ${formatINR(amountValue)}`);
      }

      onClose();
      onSaved();
    } catch (error: any) {
      toast.error(error.message || "Could not save the expense");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  const yesterday = subDays(today, 1);
  const isToday = isSameDay(form.date, today);
  const isYesterday = isSameDay(form.date, yesterday);

  return (
    <>
      <DialogHeader className="border-b px-5 pb-4 pt-5 text-left">
        <DialogTitle>{isEditing ? "Edit expense" : "Add an expense"}</DialogTitle>
        <DialogDescription>
          {selectedSplitSpace ? `In ${selectedSplitSpace.name}` : "Split it with your group"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Amount + title: the two things people know first */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount" className="sr-only">
                Amount
              </Label>
              <div
                className={cn(
                  "flex items-baseline gap-1 rounded-xl border bg-secondary/40 px-4 py-3 focus-within:ring-2 focus-within:ring-ring",
                  errors.amount && "border-destructive",
                )}
              >
                <span className="text-2xl font-semibold text-muted-foreground">₹</span>
                <input
                  id="amount"
                  inputMode="decimal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => {
                    setErrors((x) => ({ ...x, amount: undefined }));
                    const amount = e.target.value;
                    setForm((prev) => ({ ...prev, amount }));
                  }}
                  className="w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-invalid={!!errors.amount}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>

            <div>
              <Label htmlFor="title" className="sr-only">
                Description
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => {
                  setErrors((x) => ({ ...x, title: undefined }));
                  const title = e.target.value;
                  setForm((prev) => ({ ...prev, title }));
                }}
                placeholder="What was it for? e.g. Groceries"
                className={cn("h-11 bg-secondary/40", errors.title && "border-destructive")}
                aria-invalid={!!errors.title}
              />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
            </div>
          </div>

          {/* Paid by */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Paid by</legend>
            <div className="flex flex-wrap gap-2">
              {flatmates.map((f) => {
                const active = form.paidBy === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setErrors((x) => ({ ...x, paidBy: undefined }));
                      setForm((prev) => ({ ...prev, paidBy: f.id }));
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <PersonAvatar id={f.id} name={f.name} size="sm" />
                    <span className="max-w-[9rem] truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
            {errors.paidBy && <p className="text-xs text-destructive">{errors.paidBy}</p>}
          </fieldset>

          {/* Split between */}
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium">Split equally between</legend>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    splitBetween: allSelected ? [] : flatmates.map((f) => f.id),
                  }))
                }
              >
                {allSelected ? "Clear" : "Everyone"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {flatmates.map((f) => {
                const active = form.splitBetween.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleSplit(f.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                      active
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-dashed border-border text-muted-foreground hover:border-accent/60",
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-accent" />}
                    <span className="max-w-[9rem] truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                errors.splitBetween
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary/50 text-muted-foreground",
              )}
              aria-live="polite"
            >
              {errors.splitBetween ? (
                errors.splitBetween
              ) : perPerson !== null ? (
                <>
                  <span className="font-semibold text-foreground">{formatINR(perPerson)}</span> each ·{" "}
                  {splitCount} {splitCount === 1 ? "person" : "people"}
                </>
              ) : (
                `${splitCount} ${splitCount === 1 ? "person" : "people"} selected`
              )}
            </p>
          </fieldset>

          {/* Date + category: sensible defaults, rarely changed */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={isToday ? "default" : "outline"}
                  className="h-10 flex-1"
                  onClick={() => setForm((prev) => ({ ...prev, date: today }))}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isYesterday ? "default" : "outline"}
                  className="h-10 flex-1"
                  onClick={() => setForm((prev) => ({ ...prev, date: yesterday }))}
                >
                  Yesterday
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={!isToday && !isYesterday ? "default" : "outline"}
                      className="h-10 px-2.5"
                      aria-label="Pick a date"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {!isToday && !isYesterday && <span className="ml-1">{format(form.date, "d MMM")}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={form.date}
                      onSelect={(date) => date && setForm((prev) => ({ ...prev, date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <CategorySelector
                value={form.categoryId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
                splitSpaceId={selectedSplitSpace?.id}
              />
            </div>
          </div>
        </div>

        <div className="border-t bg-card px-5 py-4">
          <Button type="submit" className="h-11 w-full text-base" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : perPerson !== null ? (
              `Add ${formatINR(amountValue)}`
            ) : (
              "Add expense"
            )}
          </Button>
        </div>
      </form>
    </>
  );
};
