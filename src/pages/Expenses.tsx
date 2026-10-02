import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, MoreVertical, Pencil, Plus, Receipt, Search, Trash2, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage, fetchSpaceData, SpaceExpense, SpaceFlatmate } from "@/lib/spaceData";
import { formatDay, formatMoney, parseDay } from "@/lib/format";

const Expenses = () => {
  const { selectedSplitSpace, splitSpaces, loading: contextLoading } = useSplitSpace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<SpaceExpense[]>([]);
  const [flatmates, setFlatmates] = useState<SpaceFlatmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SpaceExpense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SpaceExpense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchSpaceData(selectedSplitSpace?.id ?? null);
      setFlatmates(data.flatmates);
      setExpenses(data.expenses);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(`Couldn't load expenses: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSplitSpace?.id]);

  useEffect(() => {
    if (contextLoading) return;
    if (splitSpaces.length > 0 && !selectedSplitSpace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchData();
  }, [fetchData, contextLoading, splitSpaces.length, selectedSplitSpace]);

  // "/expenses?add=1" (used by the mobile + button and the dashboard) opens the form directly.
  useEffect(() => {
    if (searchParams.get("add") && !loading && flatmates.length > 0) {
      setEditingExpense(null);
      setDialogOpen(true);
      searchParams.delete("add");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, loading, flatmates.length]);

  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

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
    const map = new Map<string, { label: string; total: number; items: SpaceExpense[] }>();
    filtered.forEach((e) => {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, { label: format(parseDay(e.date), "MMMM yyyy"), total: 0, items: [] });
      const g = map.get(key)!;
      g.total += e.amount;
      g.items.push(e);
    });
    return Array.from(map.values());
  }, [filtered]);

  const openAdd = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const openEdit = (expense: SpaceExpense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    const expense = pendingDelete;
    setPendingDelete(null);
    if (!expense) return;
    setDeleteLoading(expense.id);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) throw error;
      toast.success(`Deleted ${expense.title}`);
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error));
      console.error(error);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (!contextLoading && !selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <p className="text-muted-foreground">Pick a split space at the top to see its expenses.</p>
      </div>
    );
  }

  if (loading || contextLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {expenses.length === 0
              ? "Nothing recorded yet"
              : `${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"} · ${formatMoney(total)}`}
          </p>
        </div>
        <Button onClick={openAdd} disabled={flatmates.length === 0} className="hidden shrink-0 sm:inline-flex">
          <Plus className="mr-2 h-4 w-4" />
          Add expense
        </Button>
      </div>

      {flatmates.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Add the people you share costs with first</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Expenses are split between members of this space.
          </p>
          <Button asChild className="mt-5">
            <Link to="/dashboard">Add members</Link>
          </Button>
        </Card>
      ) : expenses.length === 0 ? (
        <Card className="p-10 text-center">
          <Receipt className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No expenses yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Add the first one and everyone's share is worked out for you.
          </p>
          <Button onClick={openAdd} className="mt-5">
            <Plus className="mr-2 h-4 w-4" />
            Add your first expense
          </Button>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, category or payer"
              className="h-11 bg-card pl-9 pr-9"
              aria-label="Search expenses"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No expenses match "{query}".</p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(group.total)}</span>
                </div>
                <Card className="divide-y overflow-hidden">
                  {group.items.map((expense) => {
                    const splitCount = expense.expense_splits.length;
                    const payer = nameById.get(expense.paid_by) ?? "Unknown";
                    return (
                      <div key={expense.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                        <div className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-secondary py-1 leading-none">
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {formatDay(expense.date, "MMM")}
                          </span>
                          <span className="text-base font-semibold">{formatDay(expense.date, "d")}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          className="min-w-0 flex-1 text-left"
                          aria-label={`Edit ${expense.title}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{expense.title}</span>
                            {expense.categories && (
                              <Badge variant="secondary" className="hidden shrink-0 font-normal sm:inline-flex">
                                {expense.categories.name}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground sm:text-sm">
                            {payer} paid · split {splitCount} {splitCount === 1 ? "way" : "ways"}
                            {splitCount > 0 && ` · ${formatMoney(expense.amount / splitCount)} each`}
                          </p>
                        </button>
                        <span className="shrink-0 text-right font-semibold tabular-nums">
                          {formatMoney(expense.amount)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground"
                              aria-label={`Actions for ${expense.title}`}
                              disabled={deleteLoading === expense.id}
                            >
                              {deleteLoading === expense.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(expense)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setPendingDelete(expense)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </Card>
              </section>
            ))
          )}
        </>
      )}

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        flatmates={flatmates}
        splitSpaceId={selectedSplitSpace?.id}
        expense={editingExpense}
        onSaved={fetchData}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this expense?"
        description={
          pendingDelete && (
            <>
              <span className="font-medium text-foreground">{pendingDelete.title}</span> (
              {formatMoney(pendingDelete.amount)}) will be removed and everyone's balances recalculated. This can't be
              undone.
            </>
          )
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Expenses;
