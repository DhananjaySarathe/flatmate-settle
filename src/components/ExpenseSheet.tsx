import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, isSameDay, subDays } from "date-fns";
import { CalendarDays, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ChoiceChip } from "@/components/ChoiceChip";
import { PersonAvatar } from "@/components/PersonAvatar";
import { iconForCategory } from "@/lib/categoryIcons";
import { EmptyState } from "@/components/EmptyState";
import { useRefreshSpaceData, useSpaceData } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import {
  createCategory,
  createExpense,
  deleteExpense,
  DuplicateCategoryError,
  updateExpense,
  type ExpenseDraft,
} from "@/lib/mutations";
import { errorMessage, type Expense } from "@/lib/db";
import { formatMoney, parseDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ExpenseSheetTarget = { mode: "new" } | { mode: "edit"; expense: Expense };

interface ExpenseSheetProps {
  open: boolean;
  /** Kept after closing so the sheet doesn't change its contents mid-animation. */
  target: ExpenseSheetTarget;
  /** Bumped on every open so reopening the same target resets the form. */
  openCount: number;
  onClose: () => void;
}

/** DECIMAL(10, 2) upper bound. */
const MAX_AMOUNT = 99999999.99;
const LAST_PAYER_KEY = "expensewaale:lastPaidBy";

const readLastPayer = (scope: string | null): string | null => {
  if (!scope) return null;
  try {
    return JSON.parse(localStorage.getItem(LAST_PAYER_KEY) || "{}")[scope] ?? null;
  } catch {
    return null;
  }
};

const writeLastPayer = (scope: string | null, flatmateId: string) => {
  if (!scope) return;
  try {
    const map = JSON.parse(localStorage.getItem(LAST_PAYER_KEY) || "{}");
    map[scope] = flatmateId;
    localStorage.setItem(LAST_PAYER_KEY, JSON.stringify(map));
  } catch {
    // Remembering the payer is a convenience only.
  }
};

/** Keep digits, separators and at most two decimals while typing. */
const sanitizeAmount = (raw: string) => {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
};

const parseAmount = (raw: string) => {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const joinNames = (names: string[]) => {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
};

type FieldErrors = Partial<Record<"amount" | "title" | "paidBy" | "split", string>>;

export const ExpenseSheet = ({ open, target, openCount, onClose }: ExpenseSheetProps) => {
  const editing = target.mode === "edit" ? target.expense : null;
  const { flatmates, categories, spaceId, scope, space } = useSpaceData();
  const { meId } = useMe(flatmates);
  const refresh = useRefreshSpaceData();

  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [paidBy, setPaidBy] = useState("");
  const [split, setSplit] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const splitTouched = useRef(false);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setConfirmDelete(false);
    setNewCategory(null);
    splitTouched.current = false;
    if (target.mode === "edit") {
      const e = target.expense;
      setAmount(String(e.amount));
      setTitle(e.title);
      setDate(parseDateOnly(e.date));
      setPaidBy(e.paid_by);
      setSplit(e.expense_splits.map((s) => s.flatmate_id));
      setCategoryId(e.category_id);
    } else {
      setAmount("");
      setTitle("");
      setDate(new Date());
      const remembered = readLastPayer(scope);
      const fallback = flatmates.length === 1 ? flatmates[0].id : "";
      const defaultPayer = [meId, remembered].find((id) => id && flatmates.some((f) => f.id === id)) ?? fallback;
      setPaidBy(defaultPayer);
      setSplit(flatmates.map((f) => f.id));
      setCategoryId(categories.find((c) => c.name === "Misc")?.id ?? null);
    }
    // Only on open; later data refreshes must not wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCount]);

  // People can finish loading after the sheet opens; default the split to everyone then.
  useEffect(() => {
    if (open && !editing && !splitTouched.current && split.length === 0 && flatmates.length > 0) {
      setSplit(flatmates.map((f) => f.id));
    }
  }, [open, editing, flatmates, split.length]);

  const nameOf = (id: string) => (id === meId ? "You" : flatmates.find((f) => f.id === id)?.name ?? "Someone");
  const value = parseAmount(amount);
  const validAmount = Number.isFinite(value) && value > 0;
  const share = validAmount && split.length > 0 ? value / split.length : 0;

  const effect = useMemo(() => {
    if (!validAmount || !paidBy || split.length === 0) return null;
    const others = split.filter((id) => id !== paidBy);
    const payer = paidBy === meId ? "you" : nameOf(paidBy);
    if (others.length === 0) return "Only the payer is in this split, so nobody owes anything.";
    const subjects = [...others].sort((a, b) => (a === meId ? -1 : b === meId ? 1 : 0)).map(nameOf);
    const verb = others.length === 1 && others[0] !== meId ? "owes" : "owe";
    const each = others.length > 1 ? " each" : "";
    const note = split.includes(paidBy) ? "" : ` ${paidBy === meId ? "You're" : `${nameOf(paidBy)} is`} not sharing this cost.`;
    return `${joinNames(subjects)} ${verb} ${payer} ${formatMoney(share)}${each}.${note}`;
    // nameOf only reads flatmates and meId, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validAmount, paidBy, split, share, meId, flatmates]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!validAmount) next.amount = "Enter an amount above ₹0.";
    else if (value > MAX_AMOUNT) next.amount = "That's above the ₹9,99,99,999.99 limit. Split it into smaller expenses.";
    if (!title.trim()) next.title = "Say what it was for, like “Groceries”.";
    if (!paidBy) next.paidBy = "Choose who paid.";
    if (split.length === 0) next.split = "Pick at least one person to split it between.";
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.amount) return amountRef.current?.focus();
    if (found.title) return titleRef.current?.focus();
    if (Object.keys(found).length > 0) return;

    const draft: ExpenseDraft = {
      title: title.trim(),
      amount: Math.round(value * 100) / 100,
      date,
      paidBy,
      splitBetween: split,
      categoryId,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateExpense(editing, draft);
        toast.success("Changes saved");
      } else {
        const id = await createExpense(spaceId, draft);
        writeLastPayer(scope, paidBy);
        toast.success("Expense added", {
          description: `${draft.title} · ${formatMoney(draft.amount)}, ${split.length === 1 ? "1 person" : `split ${split.length} ways`}`,
          duration: 8000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await deleteExpense(id);
                await refresh(["expenses"]);
                toast("Expense removed");
              } catch (error) {
                toast.error(`Couldn't undo: ${errorMessage(error)}`);
              }
            },
          },
        });
      }
      await refresh(["expenses"]);
      onClose();
    } catch (error) {
      toast.error(`Couldn't save the expense: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      await deleteExpense(editing.id);
      await refresh(["expenses"]);
      toast.success("Expense deleted", { description: editing.title });
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      toast.error(`Couldn't delete: ${errorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  };

  const addCategory = async () => {
    const name = newCategory?.trim();
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setNewCategory(null);
      return;
    }
    setCreatingCategory(true);
    try {
      const created = await createCategory(name);
      await refresh(["categories"]);
      setCategoryId(created.id);
      setNewCategory(null);
    } catch (error) {
      toast.error(error instanceof DuplicateCategoryError ? error.message : `Couldn't add category: ${errorMessage(error)}`);
    } finally {
      setCreatingCategory(false);
    }
  };

  const toggleSplit = (id: string) => {
    splitTouched.current = true;
    setSplit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setErrors((e) => ({ ...e, split: undefined }));
  };

  const everyone = flatmates.length > 0 && split.length === flatmates.length;
  const today = new Date();
  const yesterday = subDays(today, 1);
  const customDate = !isSameDay(date, today) && !isSameDay(date, yesterday);

  const footer =
    flatmates.length === 0 ? null : (
      <div className="flex items-center gap-2">
        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="text-negative hover:bg-negative/10 hover:text-negative"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            <Trash2 />
            <span className="hidden sm:inline">Delete</span>
            <span className="sr-only sm:hidden">Delete expense</span>
          </Button>
        )}
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={saving} className="flex-1 sm:min-w-36 sm:flex-none">
            {saving && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </div>
    );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => !next && !saving && onClose()}
        title={editing ? "Edit expense" : "Add expense"}
        description={space ? `In ${space.name}` : undefined}
        footer={footer}
        initialFocus={flatmates.length > 0 && !editing ? amountRef : undefined}
      >
        {flatmates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Add the people you split with first"
            action={
              <Button asChild onClick={onClose}>
                <Link to="/people">Add people</Link>
              </Button>
            }
          >
            Expenses are split between people in this space. Names are enough; nobody needs an account.
          </EmptyState>
        ) : (
          <form id="expense-form" onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
              <label htmlFor="expense-amount" className="text-sm font-medium">
                Amount
              </label>
              <div
                className={cn(
                  "mt-1.5 flex items-center rounded-lg border bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  errors.amount && "border-negative"
                )}
              >
                <span className="text-2xl font-semibold text-muted-foreground" aria-hidden>
                  ₹
                </span>
                <input
                  ref={amountRef}
                  id="expense-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(sanitizeAmount(e.target.value));
                    setErrors((er) => ({ ...er, amount: undefined }));
                  }}
                  aria-invalid={!!errors.amount}
                  aria-describedby="expense-amount-hint"
                  className="h-14 w-full min-w-0 bg-transparent px-2 text-3xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p
                id="expense-amount-hint"
                className={cn("mt-1.5 text-sm", errors.amount ? "text-negative" : "text-muted-foreground")}
              >
                {errors.amount ??
                  (validAmount && split.length > 0
                    ? `${formatMoney(share)} each · ${split.length === 1 ? "1 person" : `${split.length} people`}`
                    : "Split equally between the people you pick below.")}
              </p>
            </div>

            <div>
              <label htmlFor="expense-title" className="text-sm font-medium">
                What was it for?
              </label>
              <Input
                ref={titleRef}
                id="expense-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((er) => ({ ...er, title: undefined }));
                }}
                placeholder="Groceries, rent, dinner…"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={120}
                aria-invalid={!!errors.title}
                className={cn("mt-1.5 h-11", errors.title && "border-negative")}
              />
              {errors.title && <p className="mt-1.5 text-sm text-negative">{errors.title}</p>}
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Paid by</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {flatmates.map((f) => (
                  <ChoiceChip
                    key={f.id}
                    selected={paidBy === f.id}
                    onClick={() => {
                      setPaidBy(f.id);
                      setErrors((er) => ({ ...er, paidBy: undefined }));
                    }}
                    className="pl-1"
                  >
                    <PersonAvatar name={f.name} size="sm" />
                    {f.id === meId ? "You" : f.name}
                  </ChoiceChip>
                ))}
              </div>
              {errors.paidBy && <p className="mt-1.5 text-sm text-negative">{errors.paidBy}</p>}
            </fieldset>

            <fieldset>
              <div className="flex items-baseline justify-between gap-3">
                <legend className="text-sm font-medium">Split between</legend>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {split.length} of {flatmates.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChoiceChip
                  selected={everyone}
                  check
                  onClick={() => {
                    splitTouched.current = true;
                    setSplit(everyone ? [] : flatmates.map((f) => f.id));
                    setErrors((er) => ({ ...er, split: undefined }));
                  }}
                >
                  Everyone
                </ChoiceChip>
                {flatmates.map((f) => (
                  <ChoiceChip key={f.id} selected={split.includes(f.id)} check onClick={() => toggleSplit(f.id)}>
                    {f.id === meId ? "You" : f.name}
                  </ChoiceChip>
                ))}
              </div>
              {errors.split && <p className="mt-1.5 text-sm text-negative">{errors.split}</p>}
              {effect && (
                <p className="mt-3 rounded-lg bg-secondary/70 px-3.5 py-2.5 text-sm leading-relaxed" aria-live="polite">
                  {effect}
                </p>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Category</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const Icon = iconForCategory(c.name);
                  return (
                    <ChoiceChip
                      key={c.id}
                      selected={categoryId === c.id}
                      onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                    >
                      <Icon className="size-3.5" strokeWidth={2} />
                      {c.name}
                    </ChoiceChip>
                  );
                })}
                {newCategory === null ? (
                  <ChoiceChip selected={false} onClick={() => setNewCategory("")} className="border-dashed text-muted-foreground">
                    <Plus className="size-3.5" />
                    New
                  </ChoiceChip>
                ) : (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Input
                      autoFocus
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCategory();
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setNewCategory(null);
                        }
                      }}
                      placeholder="Category name"
                      maxLength={40}
                      aria-label="New category name"
                      className="h-9 sm:w-44"
                    />
                    <Button type="button" size="sm" onClick={addCategory} disabled={creatingCategory || !newCategory.trim()}>
                      {creatingCategory ? <Loader2 className="animate-spin" /> : "Add"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setNewCategory(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Date</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChoiceChip selected={isSameDay(date, today)} onClick={() => setDate(today)}>
                  Today
                </ChoiceChip>
                <ChoiceChip selected={isSameDay(date, yesterday)} onClick={() => setDate(yesterday)}>
                  Yesterday
                </ChoiceChip>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <ChoiceChip selected={customDate}>
                      <CalendarDays className="size-3.5" />
                      {customDate ? format(date, "EEE, MMM d, yyyy") : "Other date"}
                    </ChoiceChip>
                  </PopoverTrigger>
                  <PopoverContent className="pointer-events-auto w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      defaultMonth={date}
                      onSelect={(d) => {
                        if (d) setDate(d);
                        setDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </fieldset>

          </form>
        )}
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(next) => !deleting && setConfirmDelete(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {editing
                ? `“${editing.title}” (${formatMoney(editing.amount)}) will be removed and everyone's balance updated. This can't be undone.`
                : ""}
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
              className="bg-negative text-white hover:bg-negative/90"
            >
              {deleting && <Loader2 className="animate-spin" />}
              Delete expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
