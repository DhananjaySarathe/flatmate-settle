import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceChip } from "@/components/ChoiceChip";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { ReportSnapshot, Settlement } from "@/lib/settlement";
import { formatMoney, parseDateOnly, plural } from "@/lib/format";

interface Props {
  snapshot: ReportSnapshot;
}

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

const buildPersonView = (name: string, snapshot: ReportSnapshot): PersonView => {
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

  return {
    myExpenses,
    totalPaid,
    totalShare,
    net: totalPaid - totalShare,
    pays: snapshot.settlements.filter((s) => s.from === name),
    receivesFrom: snapshot.settlements.filter((s) => s.to === name),
  };
};

/** "Find your share" on the public page: pick a name, see what you owe and why. */
export default function SharedMyCost({ snapshot }: Props) {
  const names = useMemo(() => snapshot.balances.map((b) => b.name), [snapshot.balances]);
  const [selected, setSelected] = useState<string | null>(null);
  const view = useMemo(() => (selected ? buildPersonView(selected, snapshot) : null), [selected, snapshot]);

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

  const usePills = names.length > 0 && names.length <= 8;
  const owes = view ? view.net < -0.01 : false;
  const isOwed = view ? view.net > 0.01 : false;

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="your-share">
      <h2 id="your-share" className="font-semibold">
        Find your share
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Pick your name to see what you owe and to whom.</p>
      <div className="mt-3">
        {usePills ? (
          <div className="flex flex-wrap gap-2">
            {names.map((n) => (
              <ChoiceChip key={n} selected={selected === n} onClick={() => setSelected(n)} className="pl-1">
                <PersonAvatar name={n} size="sm" />
                {n}
              </ChoiceChip>
            ))}
          </div>
        ) : (
          <Select value={selected ?? undefined} onValueChange={(v) => setSelected(v)}>
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

      {view && selected && (
        <div className="mt-5 space-y-5 border-t pt-5">
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              {owes ? (
                <>
                  You owe <span className="text-negative">{formatMoney(-view.net)}</span>
                </>
              ) : isOwed ? (
                <>
                  You get back <span className="text-positive">{formatMoney(view.net)}</span>
                </>
              ) : (
                "You're settled up"
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              Your share {formatMoney(view.totalShare)} · you paid {formatMoney(view.totalPaid)}
            </p>
          </div>

          {(owes ? view.pays : isOwed ? view.receivesFrom : []).length > 0 && (
            <ul className="divide-y rounded-xl border px-4">
              {(owes ? view.pays : view.receivesFrom).map((s, i) => (
                <li key={i} className="flex items-center gap-2 py-3 text-sm">
                  <span className="font-medium">{owes ? "You" : s.from}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="pays" />
                  <span className="font-medium">{owes ? s.to : "You"}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <div>
            <h3 className="text-sm font-medium">
              Expenses you're part of <span className="text-muted-foreground">({view.myExpenses.length})</span>
            </h3>
            {view.myExpenses.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{selected} wasn't in any expense in this period.</p>
            ) : (
              <div className="mt-2 divide-y rounded-xl border">
                {groupedByDate.map((g) => (
                  <div key={g.date} className="px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {format(parseDateOnly(g.date), "EEE, MMM d, yyyy")}
                    </p>
                    <ul className="mt-1.5 space-y-2">
                      {g.rows.map((r, i) => (
                        <li key={i} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.paidBy === selected ? "You" : r.paidBy} paid · split {plural(r.splitCount, "way")}
                              {r.category ? ` · ${r.category}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatMoney(r.yourShare)}</p>
                            <p className="text-[11px] text-muted-foreground tabular-nums">of {formatMoney(r.amount)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-secondary/60 px-4 py-3 text-sm font-semibold">
                  <span>Your total share</span>
                  <span className="tabular-nums">{formatMoney(view.totalShare)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
