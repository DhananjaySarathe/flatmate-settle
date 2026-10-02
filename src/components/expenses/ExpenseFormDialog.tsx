import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, subDays } from "date-fns";
import { CalendarDays, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { Chip } from "@/components/common/Chip";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import {
  useCategories,
  usePeople,
  useRefreshSpace,
  useSavedSettlements,
  type Category,
  type Person,
  type SpaceExpense,
} from "@/hooks/useSpaceData";
import { createCategory, createExpense, deleteExpense, updateExpense } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { latestSettledDay } from "@/lib/expenseFilters";
import { formatDay, formatMoney, parseAmount, parseDay, toDayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_AMOUNT = 99_999_999.99; // expenses.amount is DECIMAL(10, 2)

const lastPayerKey = (spaceId: string) => `ew:lastPayer:${spaceId}`;

const readLastPayer = (spaceId: string | undefined) => {
  if (!spaceId) return null;
  try {
    return localStorage.getItem(lastPayerKey(spaceId));
  } catch {
    return null;
  }
};

const rememberPayer = (spaceId: string, personId: string) => {
  try {
    localStorage.setItem(lastPayerKey(spaceId), personId);
  } catch {
    // Not critical: the next form just defaults to the first person.
  }
};

interface ExpenseFormDialogProps {
  open: boolean;
  /** null = add a new expense */
  expense: SpaceExpense | null;
  /** Changes every time the composer opens, so the form starts fresh. */
  session: number;
  onOpenChange: (open: boolean) => void;
}

export const ExpenseFormDialog = ({ open, expense, session, onOpenChange }: ExpenseFormDialogProps) => {
  const { selectedSplitSpace } = useSplitSpace();
  const spaceId = selectedSplitSpace?.id;
  const people = usePeople(spaceId);
  const categories = useCategories();
  const settlements = useSavedSettlements(spaceId);
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (open) setDirty(false);
  }, [open, session]);

  const hasPeople = (people.data?.length ?? 0) > 0;

  // Closing with unsaved input asks first, so a stray tap outside doesn't lose it.
  const requestClose = (next: boolean) => {
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={requestClose}>
        <ResponsiveDialogContent
          className="sm:max-w-xl"
          // Phones: don't pop the keyboard over the sheet for edits.
          onOpenAutoFocus={(event) => {
            if (expense) event.preventDefault();
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{expense ? "Edit expense" : "Add expense"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {selectedSplitSpace ? `In ${selectedSplitSpace.name}` : "Pick a group first"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {people.isPending && spaceId ? (
            <ResponsiveDialogBody>
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading people" />
              </div>
            </ResponsiveDialogBody>
          ) : !spaceId || !hasPeople ? (
            <>
              <ResponsiveDialogBody>
                <EmptyState
                  icon={Users}
                  title="Add the people you split with first"
                  description="Expenses are split between the people in this group. Add everyone who shares costs, then come back to log what was paid."
                />
              </ResponsiveDialogBody>
              <ResponsiveDialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Not now
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/dashboard", { state: { addPerson: true } });
                  }}
                >
                  <Plus /> Add people
                </Button>
              </ResponsiveDialogFooter>
            </>
          ) : (
            <ExpenseForm
              key={session}
              spaceId={spaceId}
              expense={expense}
              people={people.data ?? []}
              categories={categories.data ?? []}
              lastSettled={latestSettledDay(settlements.data ?? [])}
              onDirtyChange={setDirty}
              onCancel={() => requestClose(false)}
              onDone={() => {
                setDirty(false);
                onOpenChange(false);
              }}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={expense ? "Discard your changes?" : "Discard this expense?"}
        description="What you've entered won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </>
  );
};

interface FormErrors {
  amount?: string;
  title?: string;
  paidBy?: string;
  split?: string;
}

interface ExpenseFormProps {
  spaceId: string;
  expense: SpaceExpense | null;
  people: Person[];
  categories: Category[];
  /** "yyyy-MM-dd" of the latest settle-up marker, for the "already settled" hint. */
  lastSettled: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}

interface Snapshot {
  amountText: string;
  title: string;
  paidBy: string;
  split: string;
  day: string;
  categoryId: string | null;
}

const snapshotOf = (v: Omit<Snapshot, "split" | "day"> & { split: string[]; date: Date }): Snapshot => ({
  amountText: v.amountText.trim(),
  title: v.title.trim(),
  paidBy: v.paidBy,
  split: [...v.split].sort().join(","),
  day: toDayKey(v.date),
  categoryId: v.categoryId,
});

const ExpenseForm = ({
  spaceId,
  expense,
  people,
  categories,
  lastSettled,
  onDirtyChange,
  onCancel,
  onDone,
}: ExpenseFormProps) => {
  const refreshSpace = useRefreshSpace();
  const isEdit = !!expense;

  const [amountText, setAmountText] = useState(() => (expense ? String(expense.amount) : ""));
  const [title, setTitle] = useState(expense?.title ?? "");
  const [paidBy, setPaidBy] = useState<string>(() => {
    if (expense) return expense.paid_by;
    const last = readLastPayer(spaceId);
    return people.some((p) => p.id === last) ? last! : people[0]?.id ?? "";
  });
  const [split, setSplit] = useState<string[]>(() =>
    expense ? expense.expense_splits.map((s) => s.flatmate_id) : people.map((p) => p.id)
  );
  const [date, setDate] = useState<Date>(() => (expense ? parseDay(expense.date) : new Date()));
  const [categoryId, setCategoryId] = useState<string | null>(() => expense?.category_id ?? null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const categoryDefaulted = useRef(isEdit);

  const current = snapshotOf({ amountText, title, paidBy, split, date, categoryId });
  const initial = useRef<Snapshot>(current);
  const dirty = (Object.keys(current) as (keyof Snapshot)[]).some((k) => current[k] !== initial.current[k]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // New expenses default to "Misc", the same category the old form pre-selected.
  useEffect(() => {
    if (categoryDefaulted.current || categories.length === 0) return;
    categoryDefaulted.current = true;
    const misc = categories.find((c) => c.name === "Misc")?.id ?? null;
    setCategoryId((current) => current ?? misc);
    // The default isn't an edit the user made.
    initial.current = { ...initial.current, categoryId: initial.current.categoryId ?? misc };
  }, [categories]);

  const amount = parseAmount(amountText);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const share = validAmount && split.length > 0 ? amount / split.length : null;

  const today = new Date();
  const yesterday = subDays(today, 1);
  const isToday = isSameDay(date, today);
  const isYesterday = isSameDay(date, yesterday);

  const allSelected = split.length === people.length;
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  const togglePerson = (id: string) => {
    setSplit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setErrors((e) => ({ ...e, split: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (amountText.trim() === "") next.amount = "Enter how much was paid.";
    else if (!Number.isFinite(amount)) next.amount = "Use numbers only, e.g. 1250 or 1250.50.";
    else if (amount <= 0) next.amount = "The amount must be more than zero.";
    else if (amount > MAX_AMOUNT) next.amount = "That amount is too large to save.";
    if (!title.trim()) next.title = "Say what it was for, e.g. Groceries.";
    if (!paidBy) next.paidBy = "Choose who paid.";
    if (split.length === 0) next.split = "Pick at least one person to split with.";
    return next;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit("close");
  };

  const undoAdd = async (id: string, label: string) => {
    try {
      await deleteExpense(id);
      toast(`Removed “${label}”`);
    } catch (error) {
      toast.error("Couldn't undo", { description: errorMessage(error) });
    } finally {
      refreshSpace(spaceId);
    }
  };

  const submit = async (mode: "close" | "again") => {
    const found = validate();
    setErrors(found);
    if (found.amount) return amountRef.current?.focus();
    if (found.title) return titleRef.current?.focus();
    if (found.paidBy || found.split) return;

    const draft = {
      title: title.trim(),
      amount: Math.round(amount * 100) / 100,
      date: toDayKey(date),
      paidBy,
      categoryId,
      splitBetween: split,
    };

    setSaving(true);
    try {
      if (expense) {
        await updateExpense(
          expense.id,
          expense.expense_splits.map((s) => s.flatmate_id),
          draft
        );
        toast.success("Saved changes", { description: `${draft.title} · ${formatMoney(draft.amount)}` });
      } else {
        const id = await createExpense(spaceId, draft);
        toast.success(`Added “${draft.title}”`, {
          description: `${formatMoney(draft.amount)} paid by ${nameOf.get(paidBy)} · ${
            split.length === 1 ? `for ${nameOf.get(split[0])}` : `${formatMoney(draft.amount / split.length)} each`
          }`,
          duration: 6000,
          action: { label: "Undo", onClick: () => undoAdd(id, draft.title) },
        });
      }
      rememberPayer(spaceId, paidBy);
      if (mode === "again") {
        // Keep who paid, the split, date and category; clear what changes per receipt.
        setAmountText("");
        setTitle("");
        setErrors({});
        initial.current = snapshotOf({ amountText: "", title: "", paidBy, split, date, categoryId });
        amountRef.current?.focus();
      } else {
        onDone();
      }
    } catch (error) {
      toast.error(isEdit ? "Couldn't save all your changes" : "Couldn't add the expense", {
        description: isEdit
          ? `Check the split and try again. ${errorMessage(error)}`
          : `Nothing was saved. ${errorMessage(error)}`,
      });
    } finally {
      setSaving(false);
      // Refetch either way so the list reflects exactly what was saved.
      refreshSpace(spaceId);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    try {
      await deleteExpense(expense.id);
      toast.success(`Deleted “${expense.title}”`);
      await refreshSpace(spaceId);
      onDone();
    } catch (error) {
      toast.error("Couldn't delete the expense", { description: errorMessage(error) });
      throw error;
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategory?.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const created = await createCategory(name);
      await refreshSpace(undefined, { categories: true });
      setCategoryId(created.id);
      setNewCategory(null);
    } catch (error) {
      toast.error("Couldn't create the category", { description: errorMessage(error) });
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <>
      <ResponsiveDialogBody>
        <form id="expense-form" onSubmit={handleSubmit} noValidate className="space-y-6 pt-1">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Amount</Label>
            <div
              className={cn(
                "flex items-center rounded-lg border bg-background pl-4 transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card",
                errors.amount ? "border-debit" : "border-input"
              )}
            >
              <span className="text-2xl font-semibold text-muted-foreground" aria-hidden="true">
                ₹
              </span>
              <input
                ref={amountRef}
                id="expense-amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={!isEdit}
                placeholder="0"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  if (errors.amount) setErrors((x) => ({ ...x, amount: undefined }));
                }}
                aria-invalid={!!errors.amount}
                aria-describedby="expense-amount-hint"
                className="h-14 w-full min-w-0 bg-transparent px-2 text-3xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <p
              id="expense-amount-hint"
              className={cn("text-sm", errors.amount ? "text-debit" : "text-muted-foreground")}
              aria-live="polite"
            >
              {errors.amount ??
                (share !== null
                  ? split.length === 1
                    ? `${nameOf.get(paidBy) ?? "Someone"} paid · all of it is ${nameOf.get(split[0])}'s share`
                    : `${nameOf.get(paidBy) ?? "Someone"} paid · ${formatMoney(share)} each for ${split.length} people`
                  : "Split equally between the people you pick below")}
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-title">What was it for?</Label>
            <Input
              ref={titleRef}
              id="expense-title"
              value={title}
              maxLength={120}
              autoComplete="off"
              placeholder="e.g. Groceries, Wi-Fi bill, Dinner"
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
              }}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "expense-title-error" : undefined}
              className={cn("h-11", errors.title && "border-debit")}
            />
            {errors.title && (
              <p id="expense-title-error" className="text-sm text-debit">
                {errors.title}
              </p>
            )}
          </div>

          {/* Paid by */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Paid by</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <Chip
                  key={p.id}
                  selected={paidBy === p.id}
                  onClick={() => {
                    setPaidBy(p.id);
                    setErrors((x) => ({ ...x, paidBy: undefined }));
                  }}
                  leading={<PersonAvatar name={p.name} size="xs" className="h-7 w-7 text-[11px]" />}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
            {errors.paidBy && <p className="text-sm text-debit">{errors.paidBy}</p>}
          </fieldset>

          {/* Split between */}
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-medium">
                Split between{" "}
                <span className="font-normal text-muted-foreground">
                  ({split.length} of {people.length})
                </span>
              </legend>
              <button
                type="button"
                className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setSplit(allSelected ? [] : people.map((p) => p.id));
                  setErrors((x) => ({ ...x, split: undefined }));
                }}
              >
                {allSelected ? "Clear" : "Everyone"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <Chip
                  key={p.id}
                  selected={split.includes(p.id)}
                  showCheck
                  onClick={() => togglePerson(p.id)}
                  leading={<PersonAvatar name={p.name} size="xs" className="h-7 w-7 text-[11px]" />}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
            {errors.split && <p className="text-sm text-debit">{errors.split}</p>}
            {!errors.split && split.length > 0 && !split.includes(paidBy) && paidBy && (
              <p className="text-sm text-muted-foreground">
                {nameOf.get(paidBy)} paid but isn't in the split, so they get all of it back.
              </p>
            )}
          </fieldset>

          {/* Date */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Date</legend>
            <div className="flex flex-wrap gap-2">
              <Chip selected={isToday} onClick={() => setDate(new Date())}>
                Today
              </Chip>
              <Chip selected={isYesterday} onClick={() => setDate(subDays(new Date(), 1))}>
                Yesterday
              </Chip>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Chip
                    selected={!isToday && !isYesterday}
                    leading={<CalendarDays className="ml-1 h-4 w-4" aria-hidden="true" />}
                  >
                    {!isToday && !isYesterday ? format(date, "EEE, d MMM yyyy") : "Pick a date"}
                  </Chip>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    defaultMonth={date}
                    onSelect={(d) => {
                      if (d) setDate(d);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {lastSettled && toDayKey(date) <= lastSettled && (
              <p className="text-sm text-muted-foreground">
                This date is inside your last settle-up (ends {formatDay(lastSettled, "d MMM")}), so it won't show up in
                “Since last settle-up” balances.
              </p>
            )}
          </fieldset>

          {/* Category */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Category <span className="font-normal text-muted-foreground">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  selected={categoryId === c.id}
                  onClick={() => setCategoryId((current) => (current === c.id ? null : c.id))}
                  className="h-9"
                >
                  {c.name}
                </Chip>
              ))}
              {newCategory === null && (
                <Chip
                  className="h-9 border-dashed text-muted-foreground"
                  onClick={() => setNewCategory("")}
                  leading={<Plus className="ml-1 h-4 w-4" aria-hidden="true" />}
                >
                  New
                </Chip>
              )}
            </div>
            {newCategory !== null && (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newCategory}
                  maxLength={40}
                  placeholder="New category name"
                  aria-label="New category name"
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setNewCategory(null);
                    }
                  }}
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory || !newCategory.trim()}
                >
                  {creatingCategory && <Loader2 className="animate-spin" />}
                  Add
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNewCategory(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        {isEdit && (
          <Button
            type="button"
            variant="ghost"
            className="text-debit hover:bg-debit-soft hover:text-debit sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            <Trash2 /> Delete
          </Button>
        )}
        {!isEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit("again")}
            disabled={saving}
            className="sm:mr-auto"
          >
            Save and add another
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="hidden sm:inline-flex">
          Cancel
        </Button>
        <Button
          type="submit"
          form="expense-form"
          disabled={saving || (isEdit && !dirty)}
          className="h-11 sm:h-10"
        >
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
        </Button>
      </ResponsiveDialogFooter>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this expense?"
        description={
          expense ? (
            <p>
              “{expense.title}” ({formatMoney(expense.amount)}) will be removed and everyone's
              balances will update. This can't be undone.
            </p>
          ) : undefined
        }
        confirmLabel="Delete expense"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
};
