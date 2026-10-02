import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Receipt, Trash2, Loader2, Calendar as CalendarIcon, Search, Users, Check } from "lucide-react";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { CategorySelector } from "@/components/CategorySelector";
import { errorText, formatMoney, parseDateOnly, relativeDay } from "@/lib/format";

interface Flatmate {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  categories?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

const EXPENSE_SELECT = "*, categories (name), expense_splits (flatmate_id)";
const LAST_PAYER_KEY = "lastPaidBy";

const emptyForm = () => ({
  title: "",
  amount: "",
  date: new Date(),
  paidBy: "",
  splitBetween: [] as string[],
  categoryId: "",
});

const Expenses = () => {
  const { selectedSplitSpace, splitSpaces, loading: contextLoading } = useSplitSpace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (contextLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSplitSpace?.id, splitSpaces.length, contextLoading]);

  // The global "Add expense" buttons link here with ?add=1.
  useEffect(() => {
    if (loading || searchParams.get("add") !== "1") return;
    if (flatmates.length > 0) openAdd();
    searchParams.delete("add");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const fetchData = async () => {
    try {
      let flatmatesQuery = supabase.from("flatmates").select("id, name").order("name");
      let expensesQuery = supabase
        .from("expenses")
        .select(EXPENSE_SELECT)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedSplitSpace) {
        const scope = `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`;
        flatmatesQuery = flatmatesQuery.or(scope);
        expensesQuery = expensesQuery.or(scope);
      }

      const [flatmatesRes, expensesRes] = await Promise.all([flatmatesQuery, expensesQuery]);
      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setExpenses((expensesRes.data as unknown as Expense[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(`Couldn't load expenses: ${errorText(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

  const openAdd = () => {
    const lastPayer = localStorage.getItem(LAST_PAYER_KEY);
    setEditingExpense(null);
    setFormData({
      ...emptyForm(),
      paidBy: lastPayer && nameById.has(lastPayer) ? lastPayer : flatmates.length === 1 ? flatmates[0].id : "",
      // Most shared costs are split by everyone; untick the exceptions.
      splitBetween: flatmates.map((f) => f.id),
    });
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      date: parseDateOnly(expense.date),
      paidBy: expense.paid_by,
      splitBetween: expense.expense_splits.map((s) => s.flatmate_id),
      categoryId: expense.category_id || "",
    });
    setDialogOpen(true);
  };

  const amount = parseFloat(formData.amount);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const missing = !formData.title.trim()
    ? "Add what it was for"
    : !amountValid
    ? "Enter an amount above zero"
    : !formData.paidBy
    ? "Choose who paid"
    : formData.splitBetween.length === 0
    ? "Choose at least one person to split with"
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing) {
      toast.error(missing);
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again.");

      const fields = {
        title: formData.title.trim(),
        amount,
        date: format(formData.date, "yyyy-MM-dd"),
        paid_by: formData.paidBy,
        category_id: formData.categoryId || null,
      };

      let expenseId: string;
      if (editingExpense) {
        const { error } = await supabase.from("expenses").update(fields).eq("id", editingExpense.id);
        if (error) throw error;
        const { error: clearError } = await supabase
          .from("expense_splits")
          .delete()
          .eq("expense_id", editingExpense.id);
        if (clearError) throw clearError;
        expenseId = editingExpense.id;
      } else {
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            ...fields,
            created_by: user.id,
            ...(selectedSplitSpace ? { split_space_id: selectedSplitSpace.id } : {}),
          })
          .select()
          .single();
        if (error) throw error;
        expenseId = data.id;
      }

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(formData.splitBetween.map((flatmate_id) => ({ expense_id: expenseId, flatmate_id })));
      if (splitsError) throw splitsError;

      localStorage.setItem(LAST_PAYER_KEY, formData.paidBy);
      toast.success(
        editingExpense ? "Expense updated" : `Added ${fields.title} · ${formatMoney(amount)}`
      );
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(errorText(error));
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(`Deleted ${deleteTarget.title}`);
      setDeleteTarget(null);
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSplitMember = (id: string) =>
    setFormData((prev) => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(id)
        ? prev.splitBetween.filter((x) => x !== id)
        : [...prev.splitBetween, id],
    }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.categories?.name.toLowerCase().includes(q) ||
        nameById.get(e.paid_by)?.toLowerCase().includes(q)
    );
  }, [expenses, query, nameById]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Expense[] }>();
    filtered.forEach((e) => {
      const d = parseDateOnly(e.date);
      const key = format(d, "yyyy-MM");
      if (!map.has(key)) map.set(key, { label: format(d, "MMMM yyyy"), total: 0, items: [] });
      const group = map.get(key)!;
      group.total += e.amount;
      group.items.push(e);
    });
    return Array.from(map.values());
  }, [filtered]);

  if (!contextLoading && !selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center text-muted-foreground">
        Pick a SplitSpace at the top to see its expenses.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const perPerson = amountValid && formData.splitBetween.length > 0 ? amount / formData.splitBetween.length : 0;
  const yesterday = subDays(new Date(), 1);

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {expenses.length} expense{expenses.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(expenses.reduce((s, e) => s + e.amount, 0))} total
          </p>
        </div>
        {flatmates.length > 0 && (
          <Button onClick={openAdd} className="hidden sm:inline-flex">
            <Plus className="mr-1.5 h-4 w-4" />
            Add expense
          </Button>
        )}
      </div>

      {flatmates.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Add people first</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Expenses are split between people in this SplitSpace.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Add people</Link>
            </Button>
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No expenses yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Rent, groceries, a cab: log it once and everyone's share is worked out.
            </p>
            <Button onClick={openAdd} className="mt-4">
              <Plus className="mr-1.5 h-4 w-4" />
              Add first expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, category or who paid"
              className="pl-9"
              aria-label="Search expenses"
            />
          </div>

          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses match "{query}".</p>
          )}

          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(group.total)}</span>
              </div>
              <Card>
                <ul className="divide-y divide-border/60">
                  {group.items.map((expense) => {
                    const splitCount = expense.expense_splits.length;
                    const share = splitCount ? expense.amount / splitCount : 0;
                    return (
                      <li key={expense.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{expense.title}</p>
                              {expense.categories && (
                                <Badge variant="secondary" className="hidden shrink-0 text-[11px] font-normal sm:inline-flex">
                                  {expense.categories.name}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {nameById.get(expense.paid_by) ?? "Someone"} paid · {relativeDay(expense.date)} ·{" "}
                              {splitCount === flatmates.length ? "everyone" : `${splitCount} ${splitCount === 1 ? "person" : "people"}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
                            {splitCount > 1 && (
                              <p className="text-xs tabular-nums text-muted-foreground">{formatMoney(share)} each</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription className="sr-only">
              Enter the amount, who paid, and who it's split between.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">What was it for?</Label>
                <Input
                  id="title"
                  autoFocus={!editingExpense}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Groceries, rent, cab…"
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                    className="pl-7 text-right font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Paid by</legend>
              <div className="flex flex-wrap gap-2">
                {flatmates.map((f) => (
                  <Chip key={f.id} selected={formData.paidBy === f.id} onClick={() => setFormData({ ...formData, paidBy: f.id })}>
                    {f.name}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">Split equally between</legend>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      splitBetween: formData.splitBetween.length === flatmates.length ? [] : flatmates.map((f) => f.id),
                    })
                  }
                >
                  {formData.splitBetween.length === flatmates.length ? "Clear" : "Everyone"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {flatmates.map((f) => (
                  <Chip
                    key={f.id}
                    selected={formData.splitBetween.includes(f.id)}
                    onClick={() => toggleSplitMember(f.id)}
                    check
                  >
                    {f.name}
                  </Chip>
                ))}
              </div>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {formData.splitBetween.length === 0
                  ? "Nobody selected yet."
                  : perPerson > 0
                  ? `${formatMoney(perPerson)} each · ${formData.splitBetween.length} ${
                      formData.splitBetween.length === 1 ? "person" : "people"
                    }`
                  : `${formData.splitBetween.length} ${formData.splitBetween.length === 1 ? "person" : "people"} selected`}
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <div className="flex gap-1.5">
                  <Chip small selected={isToday(formData.date)} onClick={() => setFormData({ ...formData, date: new Date() })}>
                    Today
                  </Chip>
                  <Chip small selected={isYesterday(formData.date)} onClick={() => setFormData({ ...formData, date: yesterday })}>
                    Yesterday
                  </Chip>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 rounded-full px-3",
                          !isToday(formData.date) && !isYesterday(formData.date) && "border-primary bg-primary/10 text-primary"
                        )}
                        aria-label="Pick a date"
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {!isToday(formData.date) && !isYesterday(formData.date) && (
                          <span className="ml-1.5">{format(formData.date, "d MMM")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => {
                          if (date) setFormData({ ...formData, date });
                          setDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Category <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <CategorySelector
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  splitSpaceId={selectedSplitSpace?.id}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
              {editingExpense ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(editingExpense)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={submitLoading} className="sm:min-w-36">
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingExpense ? "Save changes" : amountValid ? `Add ${formatMoney(amount)}` : "Add expense"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && formatMoney(deleteTarget.amount)} will be removed from everyone's balances. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Chip = ({
  selected,
  onClick,
  children,
  check,
  small,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  check?: boolean;
  small?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      small ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
      selected
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-background text-foreground hover:bg-secondary"
    )}
  >
    {check && selected && <Check className="h-3.5 w-3.5" />}
    {children}
  </button>
);

export default Expenses;
