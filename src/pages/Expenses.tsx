import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Receipt, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseDialog } from "@/contexts/ExpenseDialogContext";
import { useSpaceData } from "@/hooks/useSpaceData";
import { PageHeader } from "@/components/common/PageHeader";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { formatMoney, parseDay } from "@/lib/format";

const ALL = "__all__";

const Expenses = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const { openAddExpense, openEditExpense } = useExpenseDialog();
  const { flatmates, expenses, loading } = useSpaceData();
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<string>(ALL);

  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);
  const nameOf = (id: string) => nameById.get(id) ?? "Unknown";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (person !== ALL && e.paid_by !== person && !e.expense_splits.some((s) => s.flatmate_id === person)) {
        return false;
      }
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.categories?.name ?? "").toLowerCase().includes(q) ||
        (nameById.get(e.paid_by) ?? "").toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      );
    });
  }, [expenses, query, person, nameById]);

  const months = useMemo(() => {
    const groups: { key: string; label: string; total: number; items: typeof filtered }[] = [];
    for (const e of filtered) {
      const d = parseDay(e.date);
      const key = format(d, "yyyy-MM");
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: format(d, "MMMM yyyy"), total: 0, items: [] };
        groups.push(g);
      }
      g.items.push(e);
      g.total += e.amount;
    }
    return groups;
  }, [filtered]);

  const filtering = query.trim() !== "" || person !== ALL;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <PageHeader
        title="Expenses"
        description={
          expenses.length > 0
            ? `${expenses.length} expense${expenses.length === 1 ? "" : "s"} · ${formatMoney(
                expenses.reduce((s, e) => s + e.amount, 0)
              )} in ${selectedSplitSpace?.name ?? "total"}`
            : undefined
        }
        actions={
          flatmates.length > 0 && (
            <Button onClick={openAddExpense} className="hidden md:inline-flex">
              <Plus className="mr-1.5 h-4 w-4" />
              Add expense
            </Button>
          )
        }
      />

      {flatmates.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Add the people you share costs with first.</p>
            <Button asChild>
              <Link to="/dashboard#people">Add people</Link>
            </Button>
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No expenses yet</p>
              <p className="text-sm text-muted-foreground">Log a bill and we'll work out everyone's share.</p>
            </div>
            <Button onClick={openAddExpense}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add the first expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, category, person or amount"
                className="h-10 pl-9 pr-9"
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
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="h-10 sm:w-48" aria-label="Filter by person">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {flatmates.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    Involving {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtering && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filtered.length} match{filtered.length === 1 ? "" : "es"} ·{" "}
                {formatMoney(filtered.reduce((s, e) => s + e.amount, 0))}
              </span>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setQuery("");
                  setPerson(ALL);
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {months.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No expenses match.</p>
          ) : (
            <div className="space-y-5">
              {months.map((m) => (
                <section key={m.key} aria-label={m.label}>
                  <div className="sticky top-14 z-10 -mx-4 flex items-baseline justify-between bg-background/95 px-4 py-2 backdrop-blur md:top-16">
                    <h2 className="text-sm font-semibold">{m.label}</h2>
                    <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(m.total)}</span>
                  </div>
                  <Card>
                    <CardContent className="divide-y divide-border/70 px-4 py-1">
                      {m.items.map((e) => (
                        <ExpenseRow key={e.id} expense={e} nameOf={nameOf} onSelect={openEditExpense} />
                      ))}
                    </CardContent>
                  </Card>
                </section>
              ))}
              <p className="text-center text-xs text-muted-foreground">Tap an expense to edit or delete it.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Expenses;
