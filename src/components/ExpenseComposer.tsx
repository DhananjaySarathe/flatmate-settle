import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, subDays } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Check, Loader2, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import {
  ComposerExpense,
  ExpenseComposerContext,
} from "@/contexts/expense-composer";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { CategorySelector } from "@/components/CategorySelector";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { errorMessage, formatMoney, parseDay } from "@/lib/format";

interface Person {
  id: string;
  name: string;
}

const lastPayerKey = (spaceId: string | undefined) => `lastPaidBy:${spaceId ?? "none"}`;

const readLastPayer = (spaceId: string | undefined) => {
  try {
    return localStorage.getItem(lastPayerKey(spaceId));
  } catch {
    return null;
  }
};

const writeLastPayer = (spaceId: string | undefined, flatmateId: string) => {
  try {
    localStorage.setItem(lastPayerKey(spaceId), flatmateId);
  } catch {
    // storage unavailable — the default payer just won't be remembered
  }
};

/** Keep digits and one decimal point, at most two decimals. Accepts pasted "₹1,200.50". */
const sanitizeAmount = (raw: string) => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
};

interface FormState {
  title: string;
  amount: string;
  date: Date;
  paidBy: string;
  splitBetween: string[];
  categoryId: string;
}

const emptyForm = (): FormState => ({
  title: "",
  amount: "",
  date: new Date(),
  paidBy: "",
  splitBetween: [],
  categoryId: "",
});

export const ExpenseComposerProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ComposerExpense | null>(null);
  const [session, setSession] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const openComposer = useCallback((expense?: ComposerExpense) => {
    setEditing(expense ?? null);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openComposer, dataVersion }), [openComposer, dataVersion]);

  return (
    <ExpenseComposerContext.Provider value={value}>
      {children}
      <ExpenseComposer
        key={session}
        open={open}
        onOpenChange={setOpen}
        expense={editing}
        onSaved={() => setDataVersion((v) => v + 1)}
        onAddAnother={() => openComposer()}
      />
    </ExpenseComposerContext.Provider>
  );
};

interface ExpenseComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ComposerExpense | null;
  onSaved: () => void;
  onAddAnother: () => void;
}

const ExpenseComposer = ({ open, onOpenChange, expense, onSaved, onAddAnother }: ExpenseComposerProps) => {
  const { selectedSplitSpace } = useSplitSpace();
  const isEdit = !!expense;
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [form, setForm] = useState<FormState>(() =>
    expense
      ? {
          title: expense.title,
          amount: String(expense.amount),
          date: parseDay(expense.date),
          paidBy: expense.paid_by,
          splitBetween: expense.expense_splits.map((s) => s.flatmate_id),
          categoryId: expense.category_id || "",
        }
      : emptyForm()
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // People in this space — fetched on open so newly added people always show.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setPeopleLoading(true);
      let query = supabase.from("flatmates").select("id, name").order("created_at", { ascending: true });
      if (selectedSplitSpace) {
        query = query.or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load people for this space");
        setPeopleLoading(false);
        return;
      }
      const list = data || [];
      setPeople(list);
      setPeopleLoading(false);
      if (!expense) {
        // New expense: everyone splits, payer defaults to whoever paid last time.
        const last = readLastPayer(selectedSplitSpace?.id);
        setForm((f) => ({
          ...f,
          paidBy: f.paidBy || (list.some((p) => p.id === last) ? (last as string) : list[0]?.id || ""),
          splitBetween: f.splitBetween.length ? f.splitBetween : list.map((p) => p.id),
        }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, expense, selectedSplitSpace]);

  const amountValue = parseFloat(form.amount);
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;
  const errors = {
    amount: !amountValid ? "Enter an amount above zero" : null,
    title: !form.title.trim() ? "Say what it was for" : null,
    paidBy: !form.paidBy ? "Pick who paid" : null,
    splitBetween: form.splitBetween.length === 0 ? "Pick at least one person" : null,
  };
  const isValid = !Object.values(errors).some(Boolean);
  const perPerson = amountValid && form.splitBetween.length > 0 ? amountValue / form.splitBetween.length : null;
  const everyoneSelected = people.length > 0 && form.splitBetween.length === people.length;
  const payerName = people.find((p) => p.id === form.paidBy)?.name;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSplit = (id: string) =>
    setForm((f) => ({
      ...f,
      splitBetween: f.splitBetween.includes(id)
        ? f.splitBetween.filter((x) => x !== id)
        : [...f.splitBetween, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setShowErrors(true);
      if (errors.amount) amountRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const title = form.title.trim();
      if (expense) {
        // Update expense
        const { error: expenseError } = await supabase
          .from("expenses")
          .update({
            title,
            amount: parseFloat(form.amount),
            date: format(form.date, "yyyy-MM-dd"),
            paid_by: form.paidBy,
            category_id: form.categoryId || null,
          } as never)
          .eq("id", expense.id);
        if (expenseError) throw expenseError;

        // Delete old splits
        await supabase.from("expense_splits").delete().eq("expense_id", expense.id);

        // Insert new splits
        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: expense.id,
            flatmate_id: flatmateId,
          }))
        );
        if (splitsError) throw splitsError;
        toast.success("Expense updated");
      } else {
        // Create new expense
        const expenseDataToInsert: Record<string, unknown> = {
          title,
          amount: parseFloat(form.amount),
          date: format(form.date, "yyyy-MM-dd"),
          paid_by: form.paidBy,
          created_by: user.id,
          category_id: form.categoryId || null,
        };
        // Only add split_space_id if it exists and is selected
        if (selectedSplitSpace) {
          expenseDataToInsert.split_space_id = selectedSplitSpace.id;
        }

        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .insert(expenseDataToInsert as never)
          .select()
          .single();
        if (expenseError) throw expenseError;

        // Insert splits
        const { error: splitsError } = await supabase.from("expense_splits").insert(
          form.splitBetween.map((flatmateId) => ({
            expense_id: expenseData.id,
            flatmate_id: flatmateId,
          }))
        );
        if (splitsError) throw splitsError;

        writeLastPayer(selectedSplitSpace?.id, form.paidBy);
        toast.success(`Added ${title} · ${formatMoney(parseFloat(form.amount), { compact: true })}`, {
          action: { label: "Add another", onClick: onAddAnother },
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Couldn't save the expense"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) throw error;
      toast.success(`Deleted ${expense.title}`);
      setConfirmDelete(false);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Couldn't delete the expense"));
    } finally {
      setDeleting(false);
    }
  };

  const today = new Date();
  const yesterday = subDays(today, 1);
  const dateIsToday = isSameDay(form.date, today);
  const dateIsYesterday = isSameDay(form.date, yesterday);

  const submitLabel = isEdit
    ? "Save changes"
    : amountValid
    ? `Add ${formatMoney(amountValue, { compact: true })}`
    : "Add expense";

  const footer = (
    <div className="flex items-center gap-2">
      {isEdit && (
        <Button
          type="button"
          variant="ghost"
          className="text-negative hover:bg-negative-soft hover:text-negative"
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
        >
          <Trash2 />
          Delete
        </Button>
      )}
      <div className="flex-1" />
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="hidden sm:inline-flex">
        Cancel
      </Button>
      <Button
        type="submit"
        form="expense-composer"
        disabled={saving || peopleLoading || people.length === 0}
        className="min-w-[9rem] flex-1 sm:flex-none"
      >
        {saving ? (
          <>
            <Loader2 className="animate-spin" />
            Saving
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => !saving && onOpenChange(next)}
        title={isEdit ? "Edit expense" : "Add an expense"}
        description={selectedSplitSpace ? `In ${selectedSplitSpace.name}` : undefined}
        footer={people.length > 0 || peopleLoading ? footer : undefined}
      >
        {!peopleLoading && people.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <Users className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Add people to this space first</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Expenses are split between the people in a space. Add them from Home.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Got it
            </Button>
          </div>
        ) : (
          <form id="expense-composer" onSubmit={handleSubmit} className="space-y-6 pt-1" noValidate>
            {/* Amount + title: the two things you always type */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="expense-amount" className="sr-only">
                  Amount
                </Label>
                <div
                  className={cn(
                    "flex items-baseline gap-1 rounded-xl border bg-background px-4 py-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                    showErrors && errors.amount && "border-negative"
                  )}
                >
                  <span className="text-2xl font-semibold text-muted-foreground">₹</span>
                  <input
                    ref={amountRef}
                    id="expense-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={!isEdit}
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => update("amount", sanitizeAmount(e.target.value))}
                    aria-invalid={showErrors && !!errors.amount}
                    aria-describedby="expense-amount-hint"
                    className="money w-full min-w-0 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                <p id="expense-amount-hint" className="mt-1.5 min-h-[1.25rem] text-sm">
                  {showErrors && errors.amount ? (
                    <span className="text-negative">{errors.amount}</span>
                  ) : perPerson !== null ? (
                    <span className="text-muted-foreground">
                      <span className="money font-medium text-foreground">{formatMoney(perPerson)}</span> each
                      {" · "}split {form.splitBetween.length} {form.splitBetween.length === 1 ? "way" : "ways"}
                    </span>
                  ) : null}
                </p>
              </div>

              <div>
                <Label htmlFor="expense-title" className="mb-1.5 block text-sm font-medium">
                  What was it for?
                </Label>
                <Input
                  id="expense-title"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Groceries, rent, dinner…"
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={showErrors && !!errors.title}
                  className={cn("h-11 bg-background", showErrors && errors.title && "border-negative")}
                />
                {showErrors && errors.title && <p className="mt-1.5 text-sm text-negative">{errors.title}</p>}
              </div>
            </div>

            {/* Who paid */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Paid by</legend>
              {peopleLoading ? (
                <ChipSkeleton />
              ) : (
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Paid by">
                  {people.map((p) => {
                    const selected = form.paidBy === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update("paidBy", p.id)}
                        className={cn(
                          "inline-flex h-9 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
                        )}
                      >
                        <PersonAvatar name={p.name} seed={p.id} size="xs" />
                        <span className="max-w-[9rem] truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {showErrors && errors.paidBy && <p className="mt-1.5 text-sm text-negative">{errors.paidBy}</p>}
            </fieldset>

            {/* Split between */}
            <fieldset>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <legend className="text-sm font-medium">Split equally between</legend>
                {people.length > 1 && (
                  <button
                    type="button"
                    onClick={() => update("splitBetween", everyoneSelected ? [] : people.map((p) => p.id))}
                    className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {everyoneSelected ? "Clear" : "Everyone"}
                  </button>
                )}
              </div>
              {peopleLoading ? (
                <ChipSkeleton />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {people.map((p) => {
                    const selected = form.splitBetween.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSplit(p.id)}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          selected
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-dashed border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        <span className="max-w-[9rem] truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {showErrors && errors.splitBetween ? (
                <p className="mt-1.5 text-sm text-negative">{errors.splitBetween}</p>
              ) : (
                payerName &&
                form.splitBetween.length > 0 &&
                !form.splitBetween.includes(form.paidBy) && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {payerName} paid but isn't in the split, so they get the full amount back.
                  </p>
                )
              )}
            </fieldset>

            {/* When */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Date</legend>
              <div className="flex flex-wrap gap-1.5">
                <DateChip active={dateIsToday} onClick={() => update("date", today)}>
                  Today
                </DateChip>
                <DateChip active={dateIsYesterday} onClick={() => update("date", yesterday)}>
                  Yesterday
                </DateChip>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        !dateIsToday && !dateIsYesterday
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
                      )}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {!dateIsToday && !dateIsYesterday ? format(form.date, "EEE, MMM d, yyyy") : "Other date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="pointer-events-auto w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date}
                      defaultMonth={form.date}
                      onSelect={(date) => {
                        if (date) {
                          update("date", date);
                          setDateOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </fieldset>

            {/* Category */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Category <span className="font-normal text-muted-foreground">(optional)</span>
              </legend>
              <CategorySelector
                value={form.categoryId}
                onValueChange={(value) => update("categoryId", value)}
                splitSpaceId={selectedSplitSpace?.id}
                autoDefault={!isEdit}
              />
            </fieldset>
          </form>
        )}
      </ResponsiveModal>

      <AlertDialog open={confirmDelete} onOpenChange={(next) => !deleting && setConfirmDelete(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{expense?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {expense ? formatMoney(expense.amount) : ""} expense and its split for
              everyone. Balances will be recalculated. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="animate-spin" /> : null}
              Delete expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const DateChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
    )}
  >
    {children}
  </button>
);

const ChipSkeleton = () => (
  <div className="flex flex-wrap gap-1.5" aria-busy>
    {[0, 1, 2].map((i) => (
      <span key={i} className="h-9 w-24 animate-pulse rounded-full bg-secondary" />
    ))}
  </div>
);
