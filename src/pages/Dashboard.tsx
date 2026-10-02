import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseComposer } from "@/contexts/expense-composer";
import { getOpenWindow, useSpaceLedger, LedgerFlatmate } from "@/hooks/useSpaceLedger";
import { calculateBalances, calculateSettlements, Balance } from "@/lib/settlement";
import { EPSILON, errorMessage, formatDay, formatMoney, plural } from "@/lib/format";
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { PersonDialog, PersonRecord } from "@/components/PersonDialog";
import { ExpenseRow } from "@/components/ExpenseRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const { openComposer, dataVersion } = useExpenseComposer();
  const [peopleVersion, setPeopleVersion] = useState(0);
  const { flatmates, expenses, settlements, loading, error, reload } = useSpaceLedger(
    dataVersion + peopleVersion
  );
  const navigate = useNavigate();
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person: PersonRecord | null; key: number }>({
    open: false,
    person: null,
    key: 0,
  });

  const names = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);
  const open = useMemo(() => getOpenWindow(expenses, settlements), [expenses, settlements]);
  const balances = useMemo(
    () => calculateBalances(flatmates, open.openExpenses),
    [flatmates, open.openExpenses]
  );
  const transfers = useMemo(() => calculateSettlements(balances), [balances]);
  const openTotal = open.openExpenses.reduce((sum, e) => sum + e.amount, 0);

  const openPerson = (person: PersonRecord | null) =>
    setPersonDialog((d) => ({ open: true, person, key: d.key + 1 }));

  const goSettleUp = () =>
    navigate("/reports", {
      state: open.range
        ? { range: { from: open.range.from.toISOString(), to: open.range.to.toISOString() } }
        : undefined,
    });

  const spaceName = selectedSplitSpace?.name ?? "Home";
  const subtitle =
    flatmates.length === 0
      ? "Set up who you're sharing costs with"
      : `${plural(flatmates.length, "person", "people")} · ${plural(expenses.length, "expense")}`;

  return (
    <div>
      <PageHeader
        title={spaceName}
        description={loading ? " " : subtitle}
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <Panel className="xl:col-span-3" title="To settle up">
            <SkeletonRows rows={3} />
          </Panel>
          <Panel className="xl:col-span-2" title="People">
            <SkeletonRows rows={4} />
          </Panel>
        </div>
      ) : error ? (
        <Panel>
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="font-medium">Couldn't load this space</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reload}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        </Panel>
      ) : flatmates.length === 0 ? (
        <GetStarted spaceName={spaceName} onAdded={() => setPeopleVersion((v) => v + 1)} />
      ) : (
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-5 xl:items-start">
          {/* Below xl the wrapper dissolves so People sits right under the settle-up answer. */}
          <div className="contents xl:col-span-3 xl:block xl:space-y-5">
            <SettleUpPanel
              hasExpenses={expenses.length > 0}
              settledThrough={open.settledThrough}
              openCount={open.openExpenses.length}
              openTotal={openTotal}
              transfers={transfers}
              names={names}
              onAddExpense={() => openComposer()}
              onSettleUp={goSettleUp}
            />

            <Panel
              className="order-3"
              title="Recent expenses"
              actions={
                expenses.length > 0 && (
                  <Button asChild variant="ghost" size="sm" className="h-8 text-primary hover:text-primary">
                    <Link to="/expenses">
                      See all
                      <ArrowRight />
                    </Link>
                  </Button>
                )
              }
              bodyClassName="pt-1"
            >
              {expenses.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nothing yet. Expenses you add show up here, newest first.
                </p>
              ) : (
                <div className="divide-y divide-border/70">
                  {expenses.slice(0, 5).map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      names={names}
                      peopleCount={flatmates.length}
                      onSelect={() => openComposer(expense)}
                      aside="date"
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <PeoplePanel
            className="order-2 xl:col-span-2"
            flatmates={flatmates}
            balances={balances}
            showBalances={open.openExpenses.length > 0}
            onAdd={() => openPerson(null)}
            onEdit={(p) => openPerson(p)}
          />
        </div>
      )}

      <PersonDialog
        key={personDialog.key}
        open={personDialog.open}
        onOpenChange={(o) => setPersonDialog((d) => ({ ...d, open: o }))}
        person={personDialog.person}
        expenses={expenses}
        onSaved={() => setPeopleVersion((v) => v + 1)}
      />
    </div>
  );
};

/* ---------------------------------------------------------------- */

const SettleUpPanel = ({
  hasExpenses,
  settledThrough,
  openCount,
  openTotal,
  transfers,
  names,
  onAddExpense,
  onSettleUp,
}: {
  hasExpenses: boolean;
  settledThrough: string | null;
  openCount: number;
  openTotal: number;
  transfers: { from: string; to: string; amount: number }[];
  names: Map<string, string>;
  onAddExpense: () => void;
  onSettleUp: () => void;
}) => {
  // calculateSettlements works in names; map back to ids for stable avatar colours.
  const idByName = new Map(Array.from(names.entries()).map(([id, name]) => [name, id]));
  const period = settledThrough
    ? `Since your last settle-up on ${formatDay(settledThrough)}`
    : "Across every expense so far";

  if (!hasExpenses) {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">Add your first expense</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log what someone paid and who it was for. Balances and who-pays-whom appear here.
            </p>
          </div>
          <Button onClick={onAddExpense}>
            <Plus />
            Add expense
          </Button>
        </div>
      </Panel>
    );
  }

  if (openCount === 0) {
    return (
      <Panel>
        <div className="flex items-start gap-3 py-1">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
          <div>
            <p className="font-semibold">All settled up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing new since {settledThrough ? formatDay(settledThrough) : "your last settle-up"}. New
              expenses will start the next round.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="To settle up"
      description={`${period} · ${plural(openCount, "expense")}, ${formatMoney(openTotal, { compact: true })}`}
    >
      {transfers.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
          <div>
            <p className="font-medium">Everyone's even</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Nobody needs to pay anyone right now.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {transfers.map((t, i) => (
            <li key={`${t.from}-${t.to}-${i}`} className="flex items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex min-w-0 items-center gap-2">
                  <PersonAvatar name={t.from} seed={idByName.get(t.from)} size="sm" />
                  <span className="truncate font-medium">{t.from}</span>
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  pays
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <PersonAvatar name={t.to} seed={idByName.get(t.to)} size="sm" />
                  <span className="truncate font-medium">{t.to}</span>
                </span>
              </div>
              <span className="money shrink-0 text-base font-semibold">{formatMoney(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {transfers.length > 0
            ? `${plural(transfers.length, "payment")} clears everything.`
            : "Mark the period as settled to start a fresh round."}
        </p>
        <Button onClick={onSettleUp} variant={transfers.length > 0 ? "default" : "outline"}>
          {transfers.length > 0 ? "Settle up" : "Review"}
          <ArrowRight />
        </Button>
      </div>
    </Panel>
  );
};

/* ---------------------------------------------------------------- */

const PeoplePanel = ({
  flatmates,
  balances,
  showBalances,
  onAdd,
  onEdit,
  className,
}: {
  flatmates: LedgerFlatmate[];
  balances: Balance[];
  showBalances: boolean;
  onAdd: () => void;
  onEdit: (p: LedgerFlatmate) => void;
  className?: string;
}) => {
  const byId = new Map(balances.map((b) => [b.id, b]));
  const maxAbs = Math.max(EPSILON, ...balances.map((b) => Math.abs(b.balance)));

  return (
    <Panel
      className={className}
      title="People"
      description={showBalances ? "Net balance for the open period" : undefined}
      actions={
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-8">
          <UserPlus />
          Add
        </Button>
      }
      bodyClassName="pt-1"
    >
      <ul>
        {flatmates.map((f) => {
          const b = byId.get(f.id);
          const net = b?.balance ?? 0;
          const state = Math.abs(net) < EPSILON ? "even" : net > 0 ? "gets" : "owes";
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onEdit(f)}
                className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${f.name}. Edit`}
              >
                <PersonAvatar name={f.name} seed={f.id} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  {showBalances && b ? (
                    <p className="money truncate text-xs text-muted-foreground">
                      Paid {formatMoney(b.totalPaid, { compact: true })} · share{" "}
                      {formatMoney(b.totalOwed, { compact: true })}
                    </p>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground">
                      {f.email || f.phone || "No contact details"}
                    </p>
                  )}
                </div>
                {showBalances && (
                  <div className="w-24 shrink-0 text-right">
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
                          {formatMoney(Math.abs(net), { compact: true })}
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-secondary">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              state === "gets" ? "ml-auto bg-positive/70" : "bg-negative/70"
                            )}
                            style={{ width: `${Math.max(6, (Math.abs(net) / maxAbs) * 100)}%` }}
                          />
                        </span>
                      </>
                    )}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

/* ---------------------------------------------------------------- */

const GetStarted = ({ spaceName, onAdded }: { spaceName: string; onAdded: () => void }) => {
  const { selectedSplitSpace } = useSplitSpace();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const { openComposer } = useExpenseComposer();

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const row: Record<string, unknown> = { name: trimmed, email: null, phone: null, created_by: user.id };
      if (selectedSplitSpace) row.split_space_id = selectedSplitSpace.id;
      const { error } = await supabase.from("flatmates").insert(row as never);
      if (error) throw error;
      setAdded((a) => [...a, trimmed]);
      setName("");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that person"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="max-w-xl">
      <div className="py-2">
        <h2 className="text-lg font-semibold tracking-tight">Who's sharing costs in {spaceName}?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add everyone who splits bills here, including you. You can add email and phone later.
        </p>

        <form onSubmit={addPerson} className="mt-5 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Asha"
            aria-label="Name"
            autoFocus
            maxLength={60}
            className="h-11"
          />
          <Button type="submit" className="h-11" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            Add
          </Button>
        </form>

        {added.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Added people">
            {added.map((n, i) => (
              <li key={`${n}-${i}`} className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-sm">
                <PersonAvatar name={n} size="xs" />
                {n}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {added.length < 2 ? "Add at least two people to start splitting." : "Looks good. Log the first bill."}
          </p>
          <Button
            variant={added.length >= 2 ? "default" : "outline"}
            disabled={added.length === 0}
            onClick={() => {
              onAdded();
              if (added.length >= 2) openComposer();
            }}
          >
            {added.length >= 2 ? "Add first expense" : "Done"}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </Panel>
  );
};

export default Dashboard;
