import { useId, useMemo, useState } from "react";
import { isValid } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/components/common/PageHeader";
import { Chip } from "@/components/common/Chip";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState } from "@/components/common/EmptyState";
import { Amount } from "@/components/common/Amount";
import { balanceStatus, formatDay, formatMoney, parseDay, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportSnapshot, Settlement } from "@/lib/settlement";

interface Props {
  snapshot: ReportSnapshot;
  /** Optional controlled selection, so the page can open this tab on a person. */
  selected?: string | null;
  onSelectedChange?: (name: string) => void;
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

/** Everything here comes from the stored snapshot; nothing is re-fetched. */
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

/** Show at most this many names as pills; beyond that a dropdown is easier to scan. */
const MAX_PILLS = 8;

/** A stored amount that isn't a usable number shows a dash, never "₹NaN". */
const money = (value: number): string => (Number.isFinite(value) ? formatMoney(value) : "—");

const dayHeading = (value: string) => {
  const day = parseDay(value);
  return isValid(day) ? formatDay(day, "EEE, d MMM yyyy") : value;
};

export default function SharedMyCost({ snapshot, selected: controlled, onSelectedChange }: Props) {
  // The snapshot identifies people by name, so a repeated name is one choice.
  const names = useMemo(
    () => Array.from(new Set(snapshot.balances.map((b) => b.name))),
    [snapshot.balances]
  );
  const uid = useId();
  const pickerLabelId = `${uid}-picker-label`;
  const pickerTriggerId = `${uid}-picker-trigger`;
  const expensesHeadingId = `${uid}-expenses-heading`;
  const [uncontrolled, setUncontrolled] = useState<string | null>(null);
  const selected = controlled !== undefined ? controlled : uncontrolled;
  const select = (name: string) => {
    if (controlled === undefined) setUncontrolled(name);
    onSelectedChange?.(name);
  };

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

  if (names.length === 0) {
    return (
      <Panel>
        <EmptyState
          compact
          title="Nobody in this snapshot"
          description="There are no people to show a share for."
        />
      </Panel>
    );
  }

  const usePills = names.length <= MAX_PILLS;
  // null only when the stored amounts don't add up to a number.
  const status = view && Number.isFinite(view.net) ? balanceStatus(view.net) : null;
  const statusText =
    status === "settled"
      ? "You're settled up"
      : status === "gets-back"
        ? "You get back"
        : status === "owes"
          ? "You owe"
          : null;
  // Always mounted, so picking the first name is announced as well as later ones.
  const announcement =
    view && selected && statusText
      ? `${selected}: ${statusText}${status === "settled" ? "" : ` ${money(Math.abs(view.net))}`}`
      : "";

  return (
    <div className="space-y-4">
      <Panel>
        <p id={pickerLabelId} className="text-sm text-muted-foreground">
          Pick your name to see what you pay and to whom.
        </p>
        {usePills ? (
          <div
            role="group"
            aria-labelledby={pickerLabelId}
            className="mt-3 flex flex-wrap gap-2"
          >
            {names.map((n) => (
              <Chip
                key={n}
                selected={selected === n}
                leading={<PersonAvatar name={n} size="xs" />}
                onClick={() => select(n)}
              >
                {n}
              </Chip>
            ))}
          </div>
        ) : (
          <Select value={selected ?? undefined} onValueChange={select}>
            <SelectTrigger
              id={pickerTriggerId}
              className="mt-3 h-11 w-full sm:w-72"
              // The prompt plus the trigger's own text, so the chosen name is read out too.
              aria-labelledby={`${pickerLabelId} ${pickerTriggerId}`}
            >
              <SelectValue placeholder="Choose your name" />
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
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </Panel>

      {view && selected && (
        <>
          <Panel>
            <div>
              <p className="break-words text-sm font-medium text-muted-foreground">{selected}</p>
              {status === "settled" ? (
                <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{statusText}</p>
              ) : status !== null ? (
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tracking-tight sm:text-2xl",
                    status === "gets-back" ? "text-credit" : "text-debit"
                  )}
                >
                  {statusText}{" "}
                  <span className="whitespace-nowrap tabular-nums">{money(Math.abs(view.net))}</span>
                </p>
              ) : null}
            </div>

            {view.pays.length > 0 || view.receivesFrom.length > 0 ? (
              <ul className="mt-4 divide-y divide-border/70 border-t">
                {view.pays.map((s, i) => (
                  <li key={`pay-${s.to}-${i}`} className="flex items-center gap-3 py-3">
                    <PersonAvatar name={s.to} size="sm" />
                    <p className="min-w-0 flex-1 break-words text-sm">
                      <span className="text-muted-foreground">Pay</span>{" "}
                      <span className="font-semibold">{s.to}</span>
                    </p>
                    <Amount value={s.amount} tone="debit" className="text-base font-semibold" />
                  </li>
                ))}
                {view.receivesFrom.map((s, i) => (
                  <li key={`get-${s.from}-${i}`} className="flex items-center gap-3 py-3">
                    <PersonAvatar name={s.from} size="sm" />
                    <p className="min-w-0 flex-1 break-words text-sm">
                      <span className="text-muted-foreground">Get back from</span>{" "}
                      <span className="font-semibold">{s.from}</span>
                    </p>
                    <Amount value={s.amount} tone="credit" className="text-base font-semibold" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {status === "settled"
                  ? "Nothing to pay or collect in this snapshot."
                  : "No payment is assigned to you in this snapshot."}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg bg-secondary/60 px-4 py-3 sm:grid-cols-3">
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs font-medium text-muted-foreground">You paid</dt>
                <dd className="text-sm font-semibold tabular-nums sm:mt-0.5 sm:text-base">
                  {money(view.totalPaid)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs font-medium text-muted-foreground">Your share</dt>
                <dd className="text-sm font-semibold tabular-nums sm:mt-0.5 sm:text-base">
                  {money(view.totalShare)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs font-medium text-muted-foreground">Net (paid − share)</dt>
                <dd className="text-sm font-semibold sm:mt-0.5 sm:text-base">
                  {Number.isFinite(view.net) ? <Amount value={view.net} tone="auto" signed /> : "—"}
                </dd>
              </div>
            </dl>
          </Panel>

          <section aria-labelledby={expensesHeadingId} className="space-y-3">
            <div>
              <h2 id={expensesHeadingId} className="text-base font-semibold tracking-tight sm:text-lg">
                Your expenses
              </h2>
              <p className="text-sm text-muted-foreground">
                In {view.myExpenses.length} of {pluralize(snapshot.expenses.length, "expense")} · your
                share of each
              </p>
            </div>

            {view.myExpenses.length === 0 ? (
              <Panel>
                <EmptyState
                  compact
                  title="Not in any expense"
                  description={`${selected} wasn't included in any expense in this period.`}
                />
              </Panel>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-card">
                {groupedByDate.map((g) => (
                  <div key={g.date} className="border-b last:border-b-0">
                    <h3 className="bg-secondary/50 px-4 py-2 text-xs font-semibold text-muted-foreground sm:px-5">
                      {dayHeading(g.date)}
                    </h3>
                    <ul className="divide-y divide-border/70">
                      {g.rows.map((r, i) => (
                        <li key={`${r.title}-${i}`} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="min-w-0 break-words text-sm font-semibold sm:text-[15px]">
                                {r.title}
                              </p>
                              {r.category && (
                                <span className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {r.category}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                              Paid by{" "}
                              <span className="font-medium text-foreground/80">{r.paidBy}</span>
                              {" · "}split {r.splitCount} {r.splitCount === 1 ? "way" : "ways"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums sm:text-[15px]">
                              <span className="sr-only">Your share </span>
                              {money(r.yourShare)}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                              of {money(r.amount)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 bg-secondary/50 px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold">Total of your shares</p>
                  <p className="text-sm font-semibold tabular-nums sm:text-[15px]">
                    {money(view.totalShare)}
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
