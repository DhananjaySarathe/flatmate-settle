import { FormEvent, ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, Copy, Link2, Loader2, Plus, RotateCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceChip } from "@/components/ChoiceChip";
import { PersonAvatar } from "@/components/PersonAvatar";
import { BalanceList, PaymentList } from "@/components/LedgerViews";
import { ExpenseRow } from "@/components/ExpenseRow";
import { EmptyState } from "@/components/EmptyState";
import { MarkSettledDialog, ShareLinkResult } from "@/components/SettleActions";
import { useShareLink } from "@/hooks/useShareLink";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useExpenseSheet } from "@/contexts/ExpenseSheetContext";
import { useRefreshSpaceData, useSpaceData } from "@/hooks/useSpaceData";
import { NOT_IN_GROUP, useMe } from "@/hooks/useMe";
import { buildLedger, openPeriod, openPeriodRange, type Payment } from "@/lib/ledger";
import { createFlatmate } from "@/lib/mutations";
import { copyText, settlementSummaryText } from "@/lib/shareText";
import { errorMessage } from "@/lib/db";
import { formatMoney, isZero, parseDateOnly, plural, todayDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

const joinPayments = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

const Dashboard = () => {
  useDocumentTitle("Home");
  const { flatmates, expenses, settlements: saved, space, spaceId, isLoading, error, refetch } = useSpaceData();
  const { me, meId, notInGroup, setMe } = useMe(flatmates);
  const { openNewExpense, openEditExpense } = useExpenseSheet();
  const share = useShareLink();
  const [settleOpen, setSettleOpen] = useState(false);

  const period = useMemo(() => openPeriod(expenses, saved), [expenses, saved]);
  const ledger = useMemo(() => buildLedger(flatmates, period.expenses), [flatmates, period.expenses]);
  const range = useMemo(() => openPeriodRange(period), [period]);

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)?.name ?? "Someone";
  const labelOf = (id: string) => (id === meId ? "You" : nameOf(id));

  if (isLoading) return <HomeSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={RotateCw}
        title="Couldn't load this space"
        action={<Button onClick={refetch}>Try again</Button>}
        className="rounded-2xl border bg-card"
      >
        {errorMessage(error)}
      </EmptyState>
    );
  }

  // A split needs two people; until then (and with nothing logged yet) keep the setup in front.
  if (flatmates.length < 2 && expenses.length === 0) {
    return <GetStarted spaceId={spaceId} spaceName={space?.name} people={flatmates.map((f) => f.name)} />;
  }

  const myBalance = me ? ledger.balances.find((b) => b.id === me.id)?.balance ?? 0 : 0;
  // "Since Oct 3" reads oddly when that's tomorrow; say what was settled instead.
  const startsInFuture = !!period.startsOn && period.startsOn > todayDateOnly();
  const sinceLabel = !period.lastSettlement
    ? "All expenses so far"
    : startsInFuture
      ? `Settled up to ${format(parseDateOnly(period.lastSettlement.to_date), "MMM d")}`
      : `Since ${format(parseDateOnly(period.startsOn as string), "MMM d")}`;
  const toSettle = ledger.payments.reduce((sum, p) => sum + p.amount, 0);
  const recent = expenses.slice(0, 5);

  const copySummary = async () => {
    const ok = await copyText(settlementSummaryText(ledger.settlements, range, space?.name));
    if (ok) toast.success("Settle-up summary copied", { description: "Paste it into your group chat." });
    else toast.error("Couldn't copy to the clipboard.");
  };

  const nothingOpen = period.expenses.length === 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* The answer sits on the page itself, not in a card, so it leads the screen. */}
      <section aria-labelledby="home-headline" className="max-w-3xl">
        <Headline
          me={me ? { id: me.id, balance: myBalance } : null}
          payments={ledger.payments}
          hasExpenses={!nothingOpen}
          toSettle={toSettle}
          labelOf={labelOf}
          neverSettled={!period.lastSettlement}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          {sinceLabel}
          {!nothingOpen && (
            <>
              {" · "}
              {plural(period.expenses.length, "expense")} · {formatMoney(ledger.total)} spent
            </>
          )}
        </p>

        {!me && !notInGroup && (
          <div className="mt-6">
            <p className="text-sm font-medium">
              Which one is you?{" "}
              <span className="font-normal text-muted-foreground">So this page can say what you owe. Saved on this device.</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {flatmates.map((f) => (
                <ChoiceChip key={f.id} selected={false} onClick={() => setMe(f.id)} className="pl-1">
                  <PersonAvatar name={f.name} size="sm" />
                  {f.name}
                </ChoiceChip>
              ))}
              <button
                type="button"
                onClick={() => setMe(NOT_IN_GROUP)}
                className="px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                I'm not in this group
              </button>
            </div>
          </div>
        )}

        {/* Day to day the sidebar button / tab-bar + adds expenses; here it's only the call to action when nothing is open. */}
        {nothingOpen && (
          <Button onClick={openNewExpense} size="lg" className="mt-6 px-5">
            <Plus />
            {expenses.length === 0 ? "Add the first expense" : "Add expense"}
          </Button>
        )}
      </section>

      {expenses.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-6">
          <div className="space-y-5 lg:space-y-6">
            {ledger.payments.length > 0 && (
              <section className="rounded-2xl border bg-card px-5 pb-5 pt-4 sm:px-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">Settle up</h2>
                  <span className="text-sm text-muted-foreground">
                    {ledger.payments.length === 1 ? "1 payment clears it" : `${ledger.payments.length} payments clear it`}
                  </span>
                </div>
                <PaymentList payments={ledger.payments} nameOf={nameOf} meId={meId} className="mt-1" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copySummary}>
                    <Copy />
                    Copy summary
                  </Button>
                  {space && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={share.creating}
                      onClick={() =>
                        share.create({
                          space,
                          range,
                          balances: ledger.balances,
                          settlements: ledger.settlements,
                          expenses: period.expenses,
                          flatmates,
                        })
                      }
                    >
                      {share.creating ? <Loader2 className="animate-spin" /> : <Link2 />}
                      Share link
                    </Button>
                  )}
                  {spaceId && (
                    <Button variant="outline" size="sm" onClick={() => setSettleOpen(true)}>
                      <CheckCircle2 />
                      Mark as settled
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                    <Link to="/reports?period=open">
                      Details
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                {share.url && (
                  <div className="mt-3">
                    <ShareLinkResult url={share.url} onDismiss={share.reset} />
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">Recent expenses</h2>
                <Link to="/expenses" className="text-sm font-medium text-primary hover:underline">
                  View all {expenses.length}
                </Link>
              </div>
              <div className="mt-1 divide-y">
                {recent.map((e) => (
                  <ExpenseRow key={e.id} expense={e} labelOf={labelOf} onSelect={openEditExpense} />
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">Balances</h2>
              <span className="text-sm text-muted-foreground">{sinceLabel}</span>
            </div>
            {nothingOpen ? (
              <p className="py-6 text-sm text-muted-foreground">Nobody owes anything right now. New expenses will show up here.</p>
            ) : (
              <BalanceList balances={ledger.balances} meId={meId} className="mt-1" />
            )}
            <div className="flex items-center justify-between gap-3 border-t py-3 text-sm">
              {me ? (
                <span className="text-muted-foreground">
                  You're {me.name}.{" "}
                  <button type="button" onClick={() => setMe(null)} className="font-medium text-foreground hover:underline">
                    Change
                  </button>
                </span>
              ) : notInGroup ? (
                <button type="button" onClick={() => setMe(null)} className="text-muted-foreground hover:text-foreground">
                  Pick which one is you
                </button>
              ) : (
                <span />
              )}
              <Link to="/people" className="font-medium text-primary hover:underline">
                People
              </Link>
            </div>
          </section>
        </div>
      )}

      {spaceId && (
        <MarkSettledDialog open={settleOpen} onOpenChange={setSettleOpen} spaceId={spaceId} range={range} />
      )}
    </div>
  );
};

interface HeadlineProps {
  me: { id: string; balance: number } | null;
  payments: Payment[];
  hasExpenses: boolean;
  toSettle: number;
  labelOf: (id: string) => string;
  neverSettled: boolean;
}

/** The answer to "where do I stand?", as a sentence rather than a dashboard tile. */
const Headline = ({ me, payments, hasExpenses, toSettle, labelOf, neverSettled }: HeadlineProps) => {
  let title: ReactNode;
  let detail: string | null = null;

  if (!hasExpenses) {
    title = neverSettled ? "No expenses yet" : "Nothing new since you settled up";
    detail = "Add an expense and everyone's share is worked out for you.";
  } else if (me) {
    const incoming = payments.filter((p) => p.toId === me.id);
    const outgoing = payments.filter((p) => p.fromId === me.id);
    if (me.balance > 0 && !isZero(me.balance)) {
      title = (
        <>
          You get back <span className="text-positive">{formatMoney(me.balance)}</span>
        </>
      );
      detail =
        incoming.length === 1
          ? `${labelOf(incoming[0].fromId)} pays you.`
          : incoming.length > 1
            ? joinPayments(incoming.map((p) => `${labelOf(p.fromId)} pays you ${formatMoney(p.amount)}`)) + "."
            : null;
    } else if (me.balance < 0 && !isZero(me.balance)) {
      title = (
        <>
          You owe <span className="text-negative">{formatMoney(-me.balance)}</span>
        </>
      );
      detail =
        outgoing.length === 1
          ? `Pay ${labelOf(outgoing[0].toId)}.`
          : outgoing.length > 1
            ? `Pay ${joinPayments(outgoing.map((p) => `${labelOf(p.toId)} ${formatMoney(p.amount)}`))}.`
            : null;
    } else {
      title = "You're settled up";
      detail = payments.length
        ? `${plural(payments.length, "payment")} still open between others.`
        : "Nobody owes anybody anything.";
    }
  } else if (payments.length > 0) {
    title = (
      <>
        {formatMoney(toSettle)} to settle
      </>
    );
    detail = `${plural(payments.length, "payment")} will square everyone up.`;
  } else {
    title = "Everyone's settled up";
    detail = "Nobody owes anybody anything.";
  }

  return (
    <div>
      <h1 id="home-headline" className="text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {detail && <p className="mt-3 text-base text-foreground/80 text-pretty sm:text-lg">{detail}</p>}
    </div>
  );
};

/** First run: no people yet. Names only; details can come later. */
const GetStarted = ({ spaceId, spaceName, people }: { spaceId: string | null; spaceName?: string; people: string[] }) => {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshSpaceData();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await createFlatmate(spaceId, { name: trimmed, email: "", phone: "" });
      await refresh(["flatmates"]);
      setName("");
      toast.success(`Added ${trimmed}`);
    } catch (error) {
      toast.error(`Couldn't add ${trimmed}: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl rounded-2xl border bg-card p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Who are you splitting with?</h1>
      <p className="mt-2 text-[15px] text-muted-foreground text-pretty">
        Add everyone who shares costs{spaceName ? ` in ${spaceName}` : ""}, including yourself. Names are enough; nobody
        needs an account.
      </p>
      {people.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="People added">
          {people.map((p) => (
            <li key={p} className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm font-medium">
              <PersonAvatar name={p} size="sm" />
              {p}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={people.length === 0 ? "Name, e.g. Riya" : "Add another person"}
          aria-label="Person's name"
          maxLength={60}
          className="h-11"
        />
        <Button type="submit" size="lg" disabled={saving || !name.trim()} className="px-5">
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </form>
      {people.length === 1 && (
        <p className="mt-2 text-sm text-muted-foreground">Add at least one more person to start splitting.</p>
      )}
      <ol className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">1.</span> Add the people in this space.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">2.</span> Log expenses as they happen, split between whoever was
          in.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">3.</span> Settle up with the fewest payments, then mark it settled.
        </li>
      </ol>
    </section>
  );
};

const HomeSkeleton = () => (
  <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading">
    <div className="space-y-3">
      <Skeleton className="h-12 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-1/2 max-w-xs" />
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6">
      <div className="space-y-3 rounded-2xl border bg-card p-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className={cn("space-y-3 rounded-2xl border bg-card p-6")}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  </div>
);

export default Dashboard;
