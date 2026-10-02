import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Receipt, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseComposer } from "@/contexts/ExpenseComposerContext";
import { useSpaceData, type SpaceExpense } from "@/hooks/useSpaceData";
import { errorMessage } from "@/lib/db";
import { formatMoney, parseDay, pluralize } from "@/lib/format";

const PAGE = 60;
const ALL = "all";

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  expenses: SpaceExpense[];
}

const Expenses = () => {
  const { selectedSplitSpace, loading: spacesLoading } = useSplitSpace();
  const { people, expenses, categories, isLoading, error, refetch } = useSpaceData(selectedSplitSpace?.id);
  const { openNew, openDetail } = useExpenseComposer();

  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [limit, setLimit] = useState(PAGE);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "Someone";
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (personId !== ALL && e.paid_by !== personId && !e.expense_splits.some((s) => s.flatmate_id === personId)) {
        return false;
      }
      if (categoryId !== ALL && e.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.categories?.name ?? "").toLowerCase().includes(q) ||
        nameOf(e.paid_by).toLowerCase().includes(q) ||
        e.expense_splits.some((s) => nameOf(s.flatmate_id).toLowerCase().includes(q))
      );
    });
  }, [expenses, query, personId, categoryId, nameOf]);

  const groups = useMemo(() => {
    const result: MonthGroup[] = [];
    for (const expense of filtered.slice(0, limit)) {
      const key = expense.date.slice(0, 7);
      let group = result[result.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: format(parseDay(expense.date), "MMMM yyyy"), total: 0, expenses: [] };
        result.push(group);
      }
      group.expenses.push(expense);
    }
    // Month totals cover every match in that month, not only the rows shown so far.
    for (const group of result) {
      group.total = filtered.filter((e) => e.date.startsWith(group.key)).reduce((sum, e) => sum + e.amount, 0);
    }
    return result;
  }, [filtered, limit]);

  const filtering = query.trim() !== "" || personId !== ALL || categoryId !== ALL;
  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);
  const selectedPerson = people.find((p) => p.id === personId);

  const clearFilters = () => {
    setQuery("");
    setPersonId(ALL);
    setCategoryId(ALL);
  };

  if (spacesLoading || (isLoading && !error)) return <ExpensesSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load expenses"
        description={errorMessage(error, "Check your connection and try again.")}
        onRetry={() => refetch()}
      />
    );
  }

  if (people.length === 0) {
    return (
      <>
        <PageHeader title="Expenses" />
        <EmptyState
          icon={Users}
          title="Add people before expenses"
          description="Expenses are split between the people in this group."
          action={
            <Button asChild>
              <Link to="/dashboard" state={{ addPerson: true }}>
                <Plus /> Add people
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Expenses"
        description={
          expenses.length === 0
            ? "Nothing added yet."
            : filtering
              ? `${pluralize(filtered.length, "match", "matches")} · ${formatMoney(filteredTotal)}`
              : `${pluralize(expenses.length, "expense")} · ${formatMoney(filteredTotal)} in total`
        }
      />

      {expenses.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Log what someone paid and who it was for. Balances update straight away."
            action={
              <Button onClick={() => openNew()}>
                <Plus /> Add the first expense
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Search by title, category or person"
                aria-label="Search expenses"
                className="h-10 bg-card pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                value={personId}
                onValueChange={(v) => {
                  setPersonId(v);
                  setLimit(PAGE);
                }}
              >
                <SelectTrigger className="h-10 bg-card sm:w-44" aria-label="Filter by person">
                  <SelectValue>{selectedPerson ? `Involving ${selectedPerson.name}` : "Everyone"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Everyone</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={categoryId}
                onValueChange={(v) => {
                  setCategoryId(v);
                  setLimit(PAGE);
                }}
              >
                <SelectTrigger className="h-10 bg-card sm:w-40" aria-label="Filter by category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card shadow-card">
              <EmptyState
                icon={Search}
                title="No matching expenses"
                description="Try a different search, or clear the filters."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    <X /> Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.key} aria-labelledby={`month-${group.key}`}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <h2 id={`month-${group.key}`} className="text-sm font-semibold">
                      {group.label}
                    </h2>
                    <p className="text-sm text-muted-foreground tabular-nums">{formatMoney(group.total)}</p>
                  </div>
                  <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
                    {group.expenses.map((expense) => (
                      <li key={expense.id}>
                        <ExpenseRow
                          expense={expense}
                          nameOf={nameOf}
                          peopleCount={people.length}
                          onOpen={openDetail}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {filtered.length > limit && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more ({filtered.length - limit} left)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ExpensesSkeleton = () => (
  <div className="mx-auto max-w-4xl" aria-busy="true" aria-label="Loading expenses">
    <Skeleton className="mb-2 h-8 w-40" />
    <Skeleton className="mb-8 h-4 w-56" />
    <Skeleton className="mb-5 h-10 w-full" />
    <div className="space-y-2 rounded-xl border bg-card p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-11 w-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  </div>
);

export default Expenses;
