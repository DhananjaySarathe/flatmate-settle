import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SharedMyCost from "@/components/SharedMyCost";
import { Panel, SkeletonRows } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { EPSILON, formatMoney, formatRange, formatRelativeDay, listNames, parseDay, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportSnapshot } from "@/lib/settlement";

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

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("shared_reports")
        .select("split_space_name, from_date, to_date, snapshot, created_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setRow(data as unknown as SharedRow);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <Panel>
        <SkeletonRows rows={4} />
      </Panel>
    );
  }

  if (notFound || !row) {
    return shell(
      <Panel className="mx-auto max-w-md">
        <div className="py-2">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Link not found
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This shared report doesn't exist or has been removed. Ask whoever sent it for a new link.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/auth">Go to ExpenseWaale</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  const { snapshot } = row;
  const total = snapshot.expenses.reduce((sum, e) => sum + e.amount, 0);

  return shell(
    <>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="h-3.5 w-3.5" />
          </span>
          Shared from ExpenseWaale
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">{snapshot.splitSpaceName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRange(parseDay(snapshot.dateRange.from), parseDay(snapshot.dateRange.to))} ·{" "}
          {plural(snapshot.expenses.length, "expense")} · {formatMoney(total, { compact: true })}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Snapshot taken {format(new Date(snapshot.generatedAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </header>

      <Panel title="Who pays whom" className="mb-5">
        {snapshot.settlements.length === 0 ? (
          <div className="flex items-start gap-3 py-1">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
            <p className="text-sm">Everyone's even. No payments needed.</p>
          </div>
        ) : (
          <ol className="divide-y divide-border/70">
            {snapshot.settlements.map((s, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <PersonAvatar name={s.from} />
                    <span className="truncate font-medium">{s.from}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    pays
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <PersonAvatar name={s.to} />
                    <span className="truncate font-medium">{s.to}</span>
                  </span>
                </div>
                <span className="money shrink-0 text-base font-semibold">{formatMoney(s.amount)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="my-cost">My share</TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <Panel bodyClassName="py-1">
            {snapshot.balances.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No balances.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {snapshot.balances.map((b) => {
                  const state = Math.abs(b.balance) < EPSILON ? "even" : b.balance > 0 ? "gets" : "owes";
                  return (
                    <li key={b.name} className="flex items-center gap-3 py-3">
                      <PersonAvatar name={b.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{b.name}</p>
                        <p className="money text-xs text-muted-foreground">
                          Paid {formatMoney(b.totalPaid)} · share {formatMoney(b.totalOwed)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {state === "even" ? (
                          <span className="text-sm text-muted-foreground">Even</span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "block text-[11px] font-medium",
                                state === "gets" ? "text-positive" : "text-negative"
                              )}
                            >
                              {state === "gets" ? "gets back" : "owes"}
                            </span>
                            <span
                              className={cn(
                                "money block text-sm font-semibold",
                                state === "gets" ? "text-positive" : "text-negative"
                              )}
                            >
                              {formatMoney(Math.abs(b.balance))}
                            </span>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="expenses">
          <Panel bodyClassName="py-1">
            {snapshot.expenses.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No expenses in this period.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {snapshot.expenses.map((e, idx) => (
                  <li key={idx} className="flex items-start gap-3 py-3">
                    <PersonAvatar name={e.paidBy} size="md" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{e.title}</span>
                        {e.category && (
                          <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {e.category}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {e.paidBy} paid · {formatRelativeDay(e.date)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Split between {listNames(e.splitBetween)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="money font-semibold">{formatMoney(e.amount, { compact: true })}</div>
                      {e.splitBetween.length > 1 && (
                        <div className="money text-xs text-muted-foreground">
                          {formatMoney(e.perPerson, { compact: true })} each
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="my-cost">
          <SharedMyCost snapshot={snapshot} />
        </TabsContent>
      </Tabs>
    </>
  );
}
