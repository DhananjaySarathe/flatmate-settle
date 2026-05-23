import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Receipt, User, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportSnapshot, Settlement } from "@/lib/settlement";

interface Props {
  snapshot: ReportSnapshot;
}

const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface PersonExpenseRow {
  date: string;
  title: string;
  paidBy: string;
  splitCount: number;
  yourShare: number;
  amount: number;
  category?: string;
}

interface PersonView {
  myExpenses: PersonExpenseRow[];
  totalPaid: number;
  totalShare: number;
  net: number;
  pays: Settlement[];
  receivesFrom: Settlement[];
}

const buildPersonView = (
  name: string,
  snapshot: ReportSnapshot
): PersonView => {
  const myExpenses: PersonExpenseRow[] = [];
  let totalPaid = 0;
  let totalShare = 0;

  for (const e of snapshot.expenses) {
    if (e.paidBy === name) totalPaid += e.amount;
    if (!e.splitBetween.includes(name)) continue;
    const share = e.splitBetween.length > 0 ? e.amount / e.splitBetween.length : 0;
    totalShare += share;
    myExpenses.push({
      date: e.date,
      title: e.title,
      paidBy: e.paidBy,
      splitCount: e.splitBetween.length,
      yourShare: share,
      amount: e.amount,
      category: e.category,
    });
  }

  const pays = snapshot.settlements.filter((s) => s.from === name);
  const receivesFrom = snapshot.settlements.filter((s) => s.to === name);

  return {
    myExpenses,
    totalPaid,
    totalShare,
    net: totalPaid - totalShare,
    pays,
    receivesFrom,
  };
};

export default function SharedMyCost({ snapshot }: Props) {
  const names = useMemo(
    () => snapshot.balances.map((b) => b.name),
    [snapshot.balances]
  );
  const [selected, setSelected] = useState<string | null>(null);

  const view = useMemo(
    () => (selected ? buildPersonView(selected, snapshot) : null),
    [selected, snapshot]
  );

  const groupedByDate = useMemo(() => {
    if (!view) return [] as { date: string; rows: PersonExpenseRow[] }[];
    const map = new Map<string, PersonExpenseRow[]>();
    for (const row of view.myExpenses) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([date, rows]) => ({ date, rows }));
  }, [view]);

  const usePills = names.length > 0 && names.length <= 6;
  const owes = view ? view.net < -0.01 : false;
  const isOwed = view ? view.net > 0.01 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
          My Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Pick your name to see what you owe and to whom.
          </p>
          {usePills ? (
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <Button
                  key={n}
                  variant={selected === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelected(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          ) : (
            <Select
              value={selected ?? undefined}
              onValueChange={(v) => setSelected(v)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {names.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!view && (
          <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Select a name above to see a personalised breakdown.
          </div>
        )}

        {view && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-secondary/30">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {isOwed ? "You are owed" : "Total you owe"}
                  </p>
                  <p
                    className={
                      "text-xl font-semibold " +
                      (owes
                        ? "text-red-600"
                        : isOwed
                        ? "text-green-600"
                        : "")
                    }
                  >
                    {formatINR(Math.abs(view.net))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Share: {formatINR(view.totalShare)} · Paid:{" "}
                    {formatINR(view.totalPaid)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/30">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expenses included
                  </p>
                  <p className="text-xl font-semibold">
                    {view.myExpenses.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    out of {snapshot.expenses.length} total
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/30">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {isOwed ? "Owed by" : owes ? "Pay to" : "Status"}
                  </p>
                  {owes ? (
                    view.pays.length > 0 ? (
                      <div className="space-y-1">
                        {view.pays.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-medium">{s.to}</span>
                            <span className="font-semibold">
                              {formatINR(s.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No payee assigned
                      </p>
                    )
                  ) : isOwed ? (
                    view.receivesFrom.length > 0 ? (
                      <div className="space-y-1">
                        {view.receivesFrom.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-medium">{s.from}</span>
                            <span className="font-semibold">
                              {formatINR(s.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nothing pending
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All settled up
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Your expenses ({view.myExpenses.length})
                </p>
              </div>
              {view.myExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 border rounded-md">
                  {selected} wasn't included in any expense in this period.
                </p>
              ) : (
                <div className="rounded-md border divide-y">
                  {groupedByDate.map((g) => (
                    <div key={g.date} className="p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {format(new Date(g.date), "EEE, MMM d, yyyy")}
                      </p>
                      <ul className="space-y-2">
                        {g.rows.map((r, i) => (
                          <li
                            key={i}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {r.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                paid by{" "}
                                <span className="font-medium text-foreground/80">
                                  {r.paidBy}
                                </span>{" "}
                                · split {r.splitCount}{" "}
                                {r.splitCount === 1 ? "way" : "ways"}
                                {r.category ? (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <Badge
                                      variant="secondary"
                                      className="ml-1 text-[10px] py-0 px-1.5"
                                    >
                                      {r.category}
                                    </Badge>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">
                                {formatINR(r.yourShare)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                of {formatINR(r.amount)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="p-3 flex items-center justify-between bg-secondary/30">
                    <p className="text-sm font-semibold">Total of your shares</p>
                    <p className="text-sm font-semibold">
                      {formatINR(view.totalShare)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {owes && view.pays.length > 0 && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-red-600" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Settlement
                  </p>
                </div>
                <ul className="space-y-2">
                  {view.pays.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{s.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{s.to}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatINR(s.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isOwed && view.receivesFrom.length > 0 && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Money coming your way
                  </p>
                </div>
                <ul className="space-y-2">
                  {view.receivesFrom.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{s.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{s.to}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatINR(s.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!owes && !isOwed && (
              <div className="rounded-md border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
                {selected} is all settled up — no transactions needed.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
