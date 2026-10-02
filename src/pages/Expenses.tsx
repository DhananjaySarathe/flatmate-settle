import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Receipt, RotateCw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/components/ExpenseRow";
import { useExpenseSheet } from "@/contexts/ExpenseSheetContext";
import { useSpaceData, type Expense } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { errorMessage } from "@/lib/db";
import { formatMoney, parseDateOnly, plural } from "@/lib/format";

const ANY = "__any__";

const Expenses = () => {
  const { flatmates, expenses, categories, space, isLoading, error, refetch } = useSpaceData();
  const { meId } = useMe(flatmates);
  const { openNewExpense, openEditExpense } = useExpenseSheet();
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState(ANY);
  const [category, setCategory] = useState(ANY);

  const labelOf = (id: string) => (id === meId ? "You" : flatmates.find((f) => f.id === id)?.name ?? "Unknown");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) return false;
      if (person !== ANY && e.paid_by !== person && !e.expense_splits.some((s) => s.flatmate_id === person)) return false;
      if (category !== ANY && e.category_id !== category) return false;
      return true;
    });
  }, [expenses, search, person, category]);

  const months = useMemo(() => {
    const groups: { key: string; label: string; total: number; items: Expense[] }[] = [];
    for (const e of filtered) {
      const key = e.date.slice(0, 7);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: format(parseDateOnly(e.date), "MMMM yyyy"), total: 0, items: [] };
        groups.push(group);
      }
      group.items.push(e);
      group.total += e.amount;
    }
    return groups;
  }, [filtered]);

  const filtering = search.trim() !== "" || person !== ANY || category !== ANY;
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const clear = () => {
    setSearch("");
    setPerson(ANY);
    setCategory(ANY);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Expenses"
        description={
          isLoading
            ? " "
            : expenses.length === 0
              ? space
                ? `Nothing logged in ${space.name} yet.`
                : "Nothing logged yet."
              : `${plural(filtered.length, "expense")} · ${formatMoney(total)}${filtering ? " matching" : ""}`
        }
        actions={
          flatmates.length > 0 && (
            <Button onClick={openNewExpense} className="hidden md:inline-flex">
              <Plus />
              Add expense
            </Button>
          )
        }
      />

      {expenses.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses"
              aria-label="Search expenses"
              className="h-10 bg-card pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="h-10 bg-card sm:w-40" aria-label="Filter by person">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Everyone</SelectItem>
                {flatmates.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.id === meId ? `You (${f.name})` : f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10 bg-card sm:w-40" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={RotateCw}
          title="Couldn't load expenses"
          action={<Button onClick={refetch}>Try again</Button>}
          className="rounded-2xl border bg-card"
        >
          {errorMessage(error)}
        </EmptyState>
      ) : flatmates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add people before logging expenses"
          action={
            <Button asChild>
              <Link to="/people">Add people</Link>
            </Button>
          }
          className="rounded-2xl border bg-card"
        >
          Every expense is split between people in this space.
        </EmptyState>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          action={
            <Button onClick={openNewExpense}>
              <Plus />
              Add the first one
            </Button>
          }
          className="rounded-2xl border bg-card"
        >
          Log what someone paid for and who it was for. Shares are worked out for you.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No expenses match"
          action={
            <Button variant="outline" onClick={clear}>
              <X />
              Clear filters
            </Button>
          }
          className="rounded-2xl border bg-card"
        >
          Try a different search, person or category.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {months.map((m) => (
            <section key={m.key} className="rounded-2xl border bg-card px-5 pb-1 sm:px-6" aria-label={m.label}>
              <div className="sticky top-14 z-10 -mx-5 flex items-baseline justify-between gap-3 rounded-t-2xl border-b bg-card/95 px-5 py-3 sm:-mx-6 sm:px-6 md:top-0">
                <h2 className="font-semibold">{m.label}</h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatMoney(m.total)} · {m.items.length}
                </span>
              </div>
              <div className="divide-y">
                {m.items.map((e) => (
                  <ExpenseRow key={e.id} expense={e} labelOf={labelOf} onSelect={openEditExpense} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Expenses;
