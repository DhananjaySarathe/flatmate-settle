import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Link2Off, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/PersonAvatar";
import { NetLabel } from "@/components/NetLabel";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import SharedMyCost from "@/components/SharedMyCost";
import { db } from "@/lib/db";
import type { ReportSnapshot } from "@/lib/settlement";
import { formatMoney, formatRange, parseDateOnly, plural } from "@/lib/format";

interface SharedRow {
  split_space_name: string;
  from_date: string;
  to_date: string;
  snapshot: ReportSnapshot;
  created_at: string;
}

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<SharedRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  useDocumentTitle(row ? `${row.snapshot.splitSpaceName} · settle-up` : "Shared summary");

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data, error } = await db
        .from("shared_reports")
        .select("split_space_name, from_date, to_date, snapshot, created_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setRow(data as unknown as SharedRow);
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Link2Off className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">This link doesn't work</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The shared summary doesn't exist or was removed. Ask whoever sent it for a new link.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/auth">Go to ExpenseWaale</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { snapshot } = row;
  const from = parseDateOnly(snapshot.dateRange.from);
  const to = parseDateOnly(snapshot.dateRange.to);
  const total = snapshot.expenses.reduce((sum, e) => sum + e.amount, 0);
  const sortedBalances = [...snapshot.balances].sort((a, b) => b.balance - a.balance);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">ExpenseWaale</span>
          <span className="ml-auto text-xs text-muted-foreground">Read-only summary</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{snapshot.splitSpaceName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatRange(from, to)} · {plural(snapshot.expenses.length, "expense")} · {formatMoney(total)} spent
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Snapshot from {format(new Date(snapshot.generatedAt), "MMM d, yyyy, h:mm a")}. Changes made after that
            aren't shown.
          </p>
        </div>

        <SharedMyCost snapshot={snapshot} />

        <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Who pays whom</h2>
            <span className="text-sm text-muted-foreground">
              {snapshot.settlements.length === 0 ? "Nothing to pay" : plural(snapshot.settlements.length, "payment")}
            </span>
          </div>
          {snapshot.settlements.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground">Everyone was square for this period.</p>
          ) : (
            <ul className="mt-1 divide-y">
              {snapshot.settlements.map((s, idx) => (
                <li key={idx} className="flex items-center gap-2 py-3">
                  <PersonAvatar name={s.from} size="sm" className="hidden sm:inline-flex" />
                  <span className="truncate text-sm font-medium">{s.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="pays" />
                  <PersonAvatar name={s.to} size="sm" className="hidden sm:inline-flex" />
                  <span className="truncate text-sm font-medium">{s.to}</span>
                  <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Balances</h2>
            <span className="text-sm text-muted-foreground">Paid minus share</span>
          </div>
          {sortedBalances.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground">No balances.</p>
          ) : (
            <ul className="mt-1 divide-y">
              {sortedBalances.map((b) => (
                <li key={b.name} className="flex items-center gap-3 py-3">
                  <PersonAvatar name={b.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{b.name}</span>
                      <NetLabel value={b.balance} className="shrink-0 text-sm" />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      Paid {formatMoney(b.totalPaid)} · Share {formatMoney(b.totalOwed)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
          <h2 className="font-semibold">
            Expenses <span className="font-normal text-muted-foreground">({snapshot.expenses.length})</span>
          </h2>
          {snapshot.expenses.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground">No expenses in this period.</p>
          ) : (
            <ul className="mt-1 divide-y">
              {snapshot.expenses.map((e, idx) => (
                <li key={idx} className="flex items-start gap-3 py-3">
                  <CategoryIcon name={e.category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{e.title}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(e.amount)}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
                      <span className="min-w-0">
                        {e.paidBy} paid · {formatMoney(e.perPerson)} each for {e.splitBetween.join(", ")}
                      </span>
                      <span className="shrink-0 tabular-nums">{format(parseDateOnly(e.date), "MMM d")}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pt-2 text-center text-xs text-muted-foreground">Shared via ExpenseWaale</p>
      </main>
    </div>
  );
}
