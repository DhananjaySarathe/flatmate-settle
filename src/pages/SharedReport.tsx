import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { format, isValid, parseISO } from "date-fns";
import { Link2Off, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, Section } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SettlementPlan } from "@/components/common/SettlementPlan";
import { BalanceList } from "@/components/common/BalanceList";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import SharedMyCost from "@/components/SharedMyCost";
import { balanceStatus, formatDay, formatMoney, formatRange, parseDay, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Balance, ReportSnapshot, SnapshotBalance, SnapshotExpense } from "@/lib/settlement";

interface SharedRow {
  split_space_name: string;
  from_date: string;
  to_date: string;
  snapshot: ReportSnapshot;
  created_at: string;
}

type TabValue = "settle" | "share" | "expenses";

/* ------------------------------------------------------------------ */
/* Reading the stored snapshot                                         */
/* ------------------------------------------------------------------ */

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

/** Stored values are shown as stored. This only refuses to print NaN. */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Stored amounts as stored; a missing or broken value shows a dash instead of "₹NaN". */
const money = (value: unknown): string => (isFiniteNumber(value) ? formatMoney(value) : "—");

const validDay = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const day = parseDay(value);
  return isValid(day) ? day : null;
};

/**
 * Words come from the sign of the stored balance. Snapshots without a usable
 * balance fall back to the stored status, whose naming is inverted for legacy
 * reasons: "owes" means a positive balance (gets money back), "needs" means owes.
 */
type ShareStatus = ReturnType<typeof balanceStatus>;
const statusOf = (b: SnapshotBalance): ShareStatus => {
  if (isFiniteNumber(b.balance)) return balanceStatus(b.balance);
  if (b.status === "owes") return "gets-back";
  if (b.status === "needs") return "owes";
  return "settled";
};

const STATUS_WORDS: Record<ShareStatus, string> = {
  "gets-back": "gets back",
  owes: "owes",
  settled: "Settled up",
};

const TRIGGER =
  "h-10 rounded-lg px-2 data-[state=active]:bg-card data-[state=active]:shadow-card";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<SharedRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadFailed(false);
      setNotFound(false);
      const { data, error } = await db
        .from("shared_reports")
        .select("split_space_name, from_date, to_date, snapshot, created_at")
        .eq("token", token)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // The request itself failed (network or server), which says nothing
        // about whether the link exists. Offer a retry instead of "not found".
        setLoadFailed(true);
      } else if (!data) {
        setNotFound(true);
      } else {
        setRow(data as unknown as SharedRow);
      }
      setLoading(false);
    };
    load().catch(() => {
      if (cancelled) return;
      setLoadFailed(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const name = row?.snapshot?.splitSpaceName || row?.split_space_name;
    if (!name) return;
    const previous = document.title;
    document.title = `${name} · ExpenseWaale`;
    return () => {
      document.title = previous;
    };
  }, [row]);

  if (loading) {
    return (
      <PublicShell>
        <ShareSkeleton />
      </PublicShell>
    );
  }

  if (loadFailed) {
    return (
      <PublicShell>
        <Panel className="mx-auto mt-6 max-w-md">
          <ErrorState
            title="Couldn't load this snapshot"
            description="Check your connection and try again."
            onRetry={retry}
          />
        </Panel>
      </PublicShell>
    );
  }

  if (notFound || !row) {
    return (
      <PublicShell>
        <Panel className="mx-auto mt-6 max-w-md">
          <EmptyState
            icon={Link2Off}
            title="This link doesn't work"
            description="It may have been removed or mistyped."
            action={
              <Button asChild>
                <Link to="/auth">Go to ExpenseWaale</Link>
              </Button>
            }
          />
        </Panel>
      </PublicShell>
    );
  }

  return (
    <PublicShell footer>
      <SnapshotView key={token} row={row} />
    </PublicShell>
  );
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

const SnapshotView = ({ row }: { row: SharedRow }) => {
  // Missing arrays become empty lists so an old or partial snapshot still
  // renders. Every value inside them is used exactly as stored.
  const snapshot = useMemo<ReportSnapshot>(() => {
    const raw: Partial<ReportSnapshot> = row.snapshot ?? {};
    return {
      generatedAt: raw.generatedAt || row.created_at,
      splitSpaceName: raw.splitSpaceName || row.split_space_name,
      dateRange: {
        from: raw.dateRange?.from || row.from_date,
        to: raw.dateRange?.to || row.to_date,
      },
      balances: asArray(raw.balances),
      settlements: asArray(raw.settlements),
      expenses: asArray(raw.expenses).map((e) => ({ ...e, splitBetween: asArray(e.splitBetween) })),
    };
  }, [row]);

  const [tab, setTab] = useState<TabValue>("settle");
  const [person, setPerson] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const shareTabRef = useRef<HTMLButtonElement>(null);

  const showPerson = (name: string) => {
    setPerson(name);
    setTab("share");
    // The tapped row unmounts with the Settle up panel, so hand focus to the
    // "Your share" tab instead of dropping it on <body>.
    shareTabRef.current?.focus({ preventScroll: true });
    tabsRef.current?.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const from = validDay(snapshot.dateRange.from);
  const to = validDay(snapshot.dateRange.to);
  const generated = snapshot.generatedAt ? parseISO(snapshot.generatedAt) : null;
  const rangeText = from && to ? formatRange(from, to) : null;
  const generatedText =
    generated && isValid(generated)
      ? format(
          generated,
          generated.getFullYear() === new Date().getFullYear() ? "d MMM, h:mm aaa" : "d MMM yyyy, h:mm aaa"
        )
      : null;

  const total = snapshot.expenses.reduce((sum, e) => sum + (isFiniteNumber(e.amount) ? e.amount : 0), 0);
  const transferTotal = snapshot.settlements.reduce(
    (sum, s) => sum + (isFiniteNumber(s.amount) ? s.amount : 0),
    0
  );
  // BalanceList formats every number it gets, so it only receives rows whose
  // stored numbers are all usable; anything else goes through the legacy list.
  const allFinite = snapshot.balances.every(
    (b) => isFiniteNumber(b.balance) && isFiniteNumber(b.totalPaid) && isFiniteNumber(b.totalOwed)
  );
  const balances: Balance[] = snapshot.balances.map((b, i) => ({
    // Names can repeat in older groups; the index keeps row keys unique.
    id: `${i}:${b.name}`,
    name: b.name,
    totalPaid: b.totalPaid,
    totalOwed: b.totalOwed,
    balance: b.balance,
  }));
  const peopleCount = snapshot.balances.length;
  // "Everyone" is only claimed when the names in the snapshot are unique, so a
  // split can be matched name for name.
  const everyone = useMemo(() => {
    const names = new Set(snapshot.balances.map((b) => b.name));
    return names.size === snapshot.balances.length && names.size > 1 ? names : null;
  }, [snapshot.balances]);
  // Show the year on each expense only when the period crosses into another year.
  const dayPattern = from && to && from.getFullYear() === to.getFullYear() ? "d MMM" : "d MMM yyyy";

  return (
    <>
      <div className="mb-6 min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {snapshot.splitSpaceName || "Shared group"}
        </h1>
        {(rangeText || generatedText) && (
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {rangeText}
            {rangeText && generatedText && " · "}
            {generatedText && <>snapshot from {generatedText}</>}
          </p>
        )}
      </div>

      <Tabs
        ref={tabsRef}
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        className="w-full scroll-mt-4"
      >
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-secondary p-1 sm:w-[28rem]">
          <TabsTrigger value="settle" className={TRIGGER}>
            Settle up
          </TabsTrigger>
          <TabsTrigger ref={shareTabRef} value="share" className={TRIGGER}>
            Your share
          </TabsTrigger>
          <TabsTrigger value="expenses" className={TRIGGER}>
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settle" className="mt-4 space-y-6">
          <Panel>
            <div className="mb-4">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">Who pays whom</h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {snapshot.settlements.length > 0
                  ? `${pluralize(snapshot.settlements.length, "payment")} · ${formatMoney(transferTotal)} in total`
                  : snapshot.expenses.length > 0
                    ? `${pluralize(snapshot.expenses.length, "expense")} · ${formatMoney(total)} spent`
                    : "No expenses in this period."}
              </p>
            </div>
            <SettlementPlan
              settlements={snapshot.settlements}
              settledTitle="All settled up"
              settledDescription="No payments needed."
            />
          </Panel>

          <Section
            title="Balances"
            description={
              peopleCount > 0
                ? "Paid minus share for each person. Choose a name for their breakdown."
                : undefined
            }
          >
            <Panel className="py-2 sm:py-2">
              {peopleCount === 0 ? (
                <EmptyState compact title="No people in this snapshot" />
              ) : allFinite ? (
                <BalanceList balances={balances} onSelect={(b) => showPerson(b.name)} />
              ) : (
                <LegacyBalanceList balances={snapshot.balances} onSelect={showPerson} />
              )}
            </Panel>
          </Section>
        </TabsContent>

        <TabsContent value="share" className="mt-4">
          <SharedMyCost snapshot={snapshot} selected={person} onSelectedChange={setPerson} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Section
            title="Expenses"
            description={
              snapshot.expenses.length > 0
                ? `${pluralize(snapshot.expenses.length, "expense")} · ${formatMoney(total)} in total`
                : undefined
            }
          >
            {snapshot.expenses.length === 0 ? (
              <Panel>
                <EmptyState compact title="No expenses in this period" />
              </Panel>
            ) : (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card shadow-card">
                {snapshot.expenses.map((e, idx) => (
                  <SnapshotExpenseRow
                    key={`${e.date}-${e.title}-${idx}`}
                    expense={e}
                    everyone={everyone}
                    dayPattern={dayPattern}
                  />
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

/**
 * "split with everyone (4)" only when the split names exactly the people in the
 * snapshot. A same-length split that includes "Unknown" or repeats a name keeps
 * its full list of names.
 */
const splitText = (names: string[], everyone: Set<string> | null): string => {
  const coversEveryone =
    everyone !== null &&
    names.length === everyone.size &&
    new Set(names).size === names.length &&
    names.every((n) => everyone.has(n));
  if (coversEveryone) return `split with everyone (${names.length})`;
  if (names.length === 1) return `all for ${names[0]}`;
  return `split with ${names.join(", ")}`;
};

const SnapshotExpenseRow = ({
  expense: e,
  everyone,
  dayPattern,
}: {
  expense: SnapshotExpense;
  everyone: Set<string> | null;
  dayPattern: string;
}) => {
  const day = validDay(e.date);
  const count = e.splitBetween.length;
  const each = isFiniteNumber(e.perPerson) ? e.perPerson : null;

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold sm:text-[15px]">{e.title}</p>
          {e.category && (
            <span className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {e.category}
            </span>
          )}
        </div>
        <p className="mt-0.5 break-words text-xs text-muted-foreground sm:text-sm">
          {day ? (
            <time dateTime={e.date} className="whitespace-nowrap">
              {formatDay(day, dayPattern)}
            </time>
          ) : (
            e.date
          )}
          {" · "}
          <span className="font-medium text-foreground/80">{e.paidBy}</span> paid ·{" "}
          {count === 0 ? (
            <span className="rounded-full bg-debit-soft px-2 py-0.5 text-[11px] font-medium text-debit">
              Nobody in split
            </span>
          ) : (
            splitText(e.splitBetween, everyone)
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums sm:text-[15px]">{money(e.amount)}</p>
        {count > 1 && each !== null && (
          <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {formatMoney(each)} each
          </p>
        )}
      </div>
    </li>
  );
};

/** Used only when a stored balance isn't a number; words then come from the stored status. */
const LegacyBalanceList = ({
  balances,
  onSelect,
}: {
  balances: SnapshotBalance[];
  onSelect: (name: string) => void;
}) => (
  <ul className="divide-y divide-border/70">
    {balances.map((b, i) => {
      const status = statusOf(b);
      const amount = isFiniteNumber(b.balance) ? formatMoney(Math.abs(b.balance)) : null;
      return (
        <li key={`${b.name}-${i}`}>
          <button
            type="button"
            onClick={() => onSelect(b.name)}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PersonAvatar name={b.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.name}</p>
              {(isFiniteNumber(b.totalPaid) || isFiniteNumber(b.totalOwed)) && (
                <p className="text-xs leading-snug text-muted-foreground tabular-nums">
                  <span className="whitespace-nowrap">Paid {money(b.totalPaid)}</span> ·{" "}
                  <span className="whitespace-nowrap">Share {money(b.totalOwed)}</span>
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-medium",
                  status === "gets-back" && "text-credit",
                  status === "owes" && "text-debit",
                  status === "settled" && "text-muted-foreground"
                )}
              >
                {STATUS_WORDS[status]}
              </p>
              {amount && status !== "settled" && (
                <p
                  className={cn(
                    "mt-1 text-base font-semibold tabular-nums",
                    status === "gets-back" ? "text-credit" : "text-debit"
                  )}
                >
                  {amount}
                </p>
              )}
            </div>
          </button>
        </li>
      );
    })}
  </ul>
);

/* ------------------------------------------------------------------ */
/* Frame                                                               */
/* ------------------------------------------------------------------ */

const Wordmark = () => (
  <Link
    to="/auth"
    className="-ml-1 flex h-10 items-center gap-2 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <Wallet className="h-4 w-4" aria-hidden="true" />
    </span>
    <span className="text-base font-bold tracking-tight">ExpenseWaale</span>
  </Link>
);

/** The public page has no app shell, so it brings its own header, gutters and background. */
const PublicShell = ({ children, footer = false }: { children: ReactNode; footer?: boolean }) => (
  <div className="min-h-dvh bg-background">
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
        <Wordmark />
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      {children}
      {footer && (
        <footer className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          Shared via{" "}
          <Link
            to="/auth"
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ExpenseWaale
          </Link>
          . Later changes don't show up here.
        </footer>
      )}
    </main>
  </div>
);

const ShareSkeleton = () => (
  <div role="status" aria-busy="true">
    <span className="sr-only">Loading snapshot…</span>
    <Skeleton className="h-8 w-56 max-w-full" />
    <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    <Skeleton className="mt-6 h-12 w-full rounded-xl sm:w-[28rem]" />
    <div className="mt-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-2 h-4 w-48" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 flex items-center gap-3">
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
    <div className="mt-6 rounded-xl border bg-card px-4 py-2 shadow-card sm:px-5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  </div>
);
