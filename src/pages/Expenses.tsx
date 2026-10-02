import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseComposer } from "@/contexts/expense-composer";
import { useSpaceLedger } from "@/hooks/useSpaceLedger";
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { ExpenseRow } from "@/components/ExpenseRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, parseDay, plural } from "@/lib/format";

const PAGE_SIZE = 60;

const Expenses = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const { openComposer, dataVersion } = useExpenseComposer();
  const { flatmates, expenses, loading, error, reload } = useSpaceLedger(dataVersion);
  const [query, setQuery] = useState("");
  const [payer, setPayer] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const names = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (payer !== "all" && e.paid_by !== payer) return false;
      if (!q) return true;
      const haystack = [e.title, e.categories?.name, names.get(e.paid_by) ?? e.flatmates?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [expenses, query, payer, names]);

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const isFiltering = query.trim() !== "" || payer !== "all";

  // Group the visible slice by month, keeping newest-first order.
  const groups = useMemo(() => {
    const out: { key: string; label: string; total: number; items: typeof filtered }[] = [];
    filtered.slice(0, visible).forEach((e) => {
      const d = parseDay(e.date);
      const key = format(d, "yyyy-MM");
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: format(d, "MMMM yyyy"), total: 0, items: [] };
        out.push(g);
      }
      g.items.push(e);
    });
    // Month totals cover the whole filtered month, not just the visible slice.
    out.forEach((g) => {
      g.total = filtered
        .filter((e) => e.date.startsWith(g.key))
        .reduce((sum, e) => sum + e.amount, 0);
    });
    return out;
  }, [filtered, visible]);

  const description = loading
    ? " "
    : isFiltering
    ? `${plural(filtered.length, "match", "matches")} · ${formatMoney(total, { compact: true })}`
    : `${plural(expenses.length, "expense")} · ${formatMoney(total, { compact: true })} in ${
        selectedSplitSpace?.name ?? "this space"
      }`;

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={description}
        actions={
          flatmates.length > 0 && (
            <Button onClick={() => openComposer()} className="hidden shadow-card sm:inline-flex lg:hidden">
              <Plus />
              Add expense
            </Button>
          )
        }
      />

      {loading ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : error ? (
        <Panel>
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="font-medium">Couldn't load expenses</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reload}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        </Panel>
      ) : flatmates.length === 0 ? (
        <Panel>
          <div className="py-4">
            <p className="font-medium">Add people before logging expenses</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every expense is paid by someone and split between people in this space.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Add people on Home</Link>
            </Button>
          </div>
        </Panel>
      ) : expenses.length === 0 ? (
        <Panel>
          <div className="py-4">
            <p className="font-medium">No expenses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a bill, a grocery run or the rent. It's split equally between whoever you pick.
            </p>
            <Button className="mt-4" onClick={() => openComposer()}>
              <Plus />
              Add the first expense
            </Button>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search title, category or person"
                aria-label="Search expenses"
                className="h-10 bg-card pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={payer}
              onValueChange={(v) => {
                setPayer(v);
                setVisible(PAGE_SIZE);
              }}
            >
              <SelectTrigger className="h-10 bg-card sm:w-48" aria-label="Filter by who paid">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Paid by anyone</SelectItem>
                {flatmates.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    Paid by {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Panel>
              <div className="flex flex-col items-start gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  No expenses match{query.trim() ? ` "${query.trim()}"` : " this filter"}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setPayer("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </Panel>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`month-${g.key}`}>
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h2 id={`month-${g.key}`} className="text-sm font-semibold">
                      {g.label}
                    </h2>
                    <span className="money text-sm text-muted-foreground">
                      {formatMoney(g.total, { compact: true })}
                    </span>
                  </div>
                  <div className="rounded-xl border bg-card px-4 shadow-card sm:px-5">
                    <div className="divide-y divide-border/70">
                      {g.items.map((expense) => (
                        <ExpenseRow
                          key={expense.id}
                          expense={expense}
                          names={names}
                          peopleCount={flatmates.length}
                          onSelect={() => openComposer(expense)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              ))}

              {filtered.length > visible && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
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

export default Expenses;
