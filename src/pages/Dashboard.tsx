import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Copy, Loader2, Plus, Receipt, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel, Section } from "@/components/common/PageHeader";
import { SettlementPlan } from "@/components/common/SettlementPlan";
import { BalanceList } from "@/components/common/BalanceList";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { PersonSheet } from "@/components/people/PersonSheet";
import { MarkSettledDialog } from "@/components/settle/MarkSettledDialog";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseComposer } from "@/contexts/ExpenseComposerContext";
import { useRefreshSpace, useSpaceData, type Person } from "@/hooks/useSpaceData";
import { useSettleView } from "@/hooks/useSettleView";
import { buildSettlementSummaryText } from "@/lib/reportText";
import { copyText } from "@/lib/clipboard";
import { createPerson } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { formatDay, formatMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const nameClash = (names: string[], candidate: string, except?: string) =>
  names.some((n) => n !== except && n.trim().toLowerCase() === candidate.trim().toLowerCase());

const Dashboard = () => {
  const {
    selectedSplitSpace,
    splitSpaces,
    loading: spacesLoading,
    error: spacesError,
    refreshSplitSpaces,
  } = useSplitSpace();
  const spaceId = selectedSplitSpace?.id;
  const { people, expenses, settlements, isLoading, error, refetch } = useSpaceData(spaceId);
  const { openNew, openDetail } = useExpenseComposer();
  const location = useLocation();
  const navigate = useNavigate();

  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [sheetPersonId, setSheetPersonId] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  // "Add people" elsewhere in the app lands here with the add field open.
  useEffect(() => {
    if ((location.state as { addPerson?: boolean } | null)?.addPerson) {
      setAddingPerson(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  // Home always shows the open period: everything after the last settle-up, unfiltered.
  const view = useSettleView({ people, expenses, settlements, preset: "since-settlement" });
  const { balances, plan, lastSettled, openPeriodLabel } = view;

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "Someone";
  }, [people]);

  const duplicateName = useMemo(() => {
    const seen = new Map<string, Person>();
    for (const p of people) {
      const key = p.name.trim().toLowerCase();
      if (seen.has(key)) return p;
      seen.set(key, p);
    }
    return null;
  }, [people]);

  const recent = expenses.slice(0, 5);
  const sheetPerson = people.find((p) => p.id === sheetPersonId) ?? null;

  const copySummary = async () => {
    const ok = await copyText(
      buildSettlementSummaryText({
        spaceName: selectedSplitSpace?.name,
        range: view.range,
        people,
        expenses: view.filtered,
        balances,
        settlements: plan,
      })
    );
    if (ok) toast.success("Summary copied", { description: "Paste it into your group chat." });
    else toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
  };

  if (spacesLoading || (isLoading && !error)) return <HomeSkeleton />;

  if (!selectedSplitSpace && spacesError) {
    return <ErrorState title="Couldn't load your groups" description={spacesError} onRetry={() => refreshSplitSpaces()} />;
  }

  if (!selectedSplitSpace) {
    return (
      <EmptyState
        icon={Users}
        title={splitSpaces.length === 0 ? "Create your first group" : "Choose a group"}
        description="A group holds the people you share costs with, like your flat or a trip."
        action={
          <Button onClick={() => navigate("/split-spaces", { state: { create: true } })}>
            <Plus /> New group
          </Button>
        }
      />
    );
  }

  if (error) {
    return <ErrorState description={errorMessage(error, "Check your connection and try again.")} onRetry={() => refetch()} />;
  }

  const personSheets = (
    <>
      <PersonFormDialog
        open={!!editingPerson}
        onOpenChange={(open) => !open && setEditingPerson(null)}
        spaceId={selectedSplitSpace.id}
        spaceName={selectedSplitSpace.name}
        person={editingPerson}
        existingNames={people.map((p) => p.name)}
      />
      <PersonSheet
        open={!!sheetPerson}
        onOpenChange={(open) => !open && setSheetPersonId(null)}
        spaceId={selectedSplitSpace.id}
        spaceName={selectedSplitSpace.name}
        person={sheetPerson}
        balance={balances.find((b) => b.id === sheetPersonId) ?? null}
        settlements={plan}
        periodExpenses={view.filtered}
        allExpenses={expenses}
        periodLabel={openPeriodLabel}
        nameOf={nameOf}
        onEdit={(p) => {
          setSheetPersonId(null);
          setEditingPerson(p);
        }}
      />
    </>
  );

  if (people.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={selectedSplitSpace.name} description="Let's set up who's splitting costs here." />
        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Who's sharing costs in {selectedSplitSpace.name}?</h2>
            <p className="text-sm text-muted-foreground">
              Add everyone who splits bills here, including yourself. They don't need an account.
            </p>
          </div>
          <QuickAddPeople spaceId={selectedSplitSpace.id} existingNames={[]} />
        </Panel>
      </div>
    );
  }

  const settledText =
    view.filtered.length === 0
      ? lastSettled
        ? `Nothing new since your last settle-up on ${formatDay(lastSettled, "d MMM")}.`
        : "Nobody owes anything right now."
      : "Everyone's shares are covered for this period.";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={selectedSplitSpace.name}
        description={`${pluralize(people.length, "person", "people")} · ${pluralize(expenses.length, "expense")}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <Panel className="lg:col-span-7">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">Who pays whom</h2>
              <p className="text-sm text-muted-foreground">
                {openPeriodLabel}
                {lastSettled ? " · after your last settle-up" : ""}
                {view.filtered.length > 0 &&
                  ` · ${pluralize(view.filtered.length, "expense")}, ${formatMoney(view.total)}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="-mr-2 shrink-0 text-primary hover:text-primary">
              <Link to="/reports">
                Settle up <ArrowRight />
              </Link>
            </Button>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              compact
              icon={Receipt}
              title="No expenses yet"
              description="Add the first one. An amount and a description is all it takes."
              action={
                <Button onClick={() => openNew()}>
                  <Plus /> Add expense
                </Button>
              }
            />
          ) : (
            <>
              <SettlementPlan settlements={plan} limit={5} settledDescription={settledText} />
              {plan.length > 0 ? (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {plan.length === 1 ? "1 payment settles everything" : `${plan.length} payments settle everything`} ·{" "}
                    {formatMoney(view.transferTotal)} in total
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setMarkOpen(true)}>
                      Mark as settled
                    </Button>
                    <Button variant="ghost" onClick={copySummary}>
                      <Copy /> Copy summary
                    </Button>
                  </div>
                </div>
              ) : (
                view.filtered.length === 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" onClick={() => openNew()}>
                      <Plus /> Add expense
                    </Button>
                  </div>
                )
              )}
            </>
          )}
        </Panel>

        <Section
          className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
          title={`People · ${people.length}`}
          description={`${openPeriodLabel}. Tap someone for their breakdown.`}
          action={
            !addingPerson && (
              <Button variant="outline" size="sm" onClick={() => setAddingPerson(true)}>
                <Plus /> Add person
              </Button>
            )
          }
        >
          {duplicateName && (
            <div className="flex items-start gap-3 rounded-lg border border-debit/25 bg-debit-soft px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-debit" aria-hidden="true" />
              <p className="min-w-0 flex-1">
                Two people are called {duplicateName.name}. Rename one so payments aren't ambiguous.
              </p>
              <Button size="sm" variant="ghost" className="-my-1 h-8" onClick={() => setEditingPerson(duplicateName)}>
                Rename
              </Button>
            </div>
          )}
          <Panel className="py-2 sm:py-2">
            {addingPerson && (
              <div className="border-b py-3">
                <InlineAddPerson
                  spaceId={selectedSplitSpace.id}
                  existingNames={people.map((p) => p.name)}
                  onClose={() => setAddingPerson(false)}
                />
              </div>
            )}
            <BalanceList balances={balances} onSelect={(b) => setSheetPersonId(b.id)} />
            {people.length === 1 && (
              <p className="border-t py-3 text-sm text-muted-foreground">Add one more person to start splitting.</p>
            )}
          </Panel>
        </Section>

        <Section
          className="lg:col-span-7"
          title="Recent expenses"
          action={
            expenses.length > 0 && (
              <Button variant="ghost" size="sm" asChild className="-mr-2 text-primary hover:text-primary">
                <Link to="/expenses">
                  See all <ArrowRight />
                </Link>
              </Button>
            )
          }
        >
          {recent.length === 0 ? (
            <Panel>
              <p className="text-sm text-muted-foreground">Expenses you add will show up here.</p>
            </Panel>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
              <ul className="divide-y">
                {recent.map((expense) => (
                  <li key={expense.id}>
                    <ExpenseRow expense={expense} nameOf={nameOf} peopleCount={people.length} onOpen={openDetail} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lastSettled && (
            <p className="px-1 text-sm text-muted-foreground">
              Expenses dated on or before {formatDay(lastSettled, "d MMM yyyy")} are covered by your last settle-up.{" "}
              <Link to="/reports" className="font-medium text-primary underline-offset-4 hover:underline">
                Pick another period on Settle up
              </Link>
              .
            </p>
          )}
        </Section>
      </div>

      <MarkSettledDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        spaceId={selectedSplitSpace.id}
        range={view.range}
        settlements={plan}
      />
      {personSheets}
    </div>
  );
};

/** One-line "type a name, press Enter" add, kept open for adding several people in a row. */
const InlineAddPerson = ({
  spaceId,
  existingNames,
  onClose,
  autoFocus = true,
}: {
  spaceId: string;
  existingNames: string[];
  onClose?: () => void;
  autoFocus?: boolean;
}) => {
  const refreshSpace = useRefreshSpace();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      inputRef.current?.focus();
      return;
    }
    if (nameClash(existingNames, trimmed)) {
      setError(`There's already someone called ${trimmed} in this group. Add an initial, like “${trimmed} S”.`);
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await createPerson(spaceId, { name: trimmed, email: null, phone: null });
      toast.success(`Added ${trimmed}`);
      setName("");
      setError(null);
      await refreshSpace(spaceId);
    } catch (err) {
      setError(errorMessage(err, "Couldn't add them. Try again."));
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={add} noValidate className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={name}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && onClose) onClose();
          }}
          placeholder="Name, e.g. Priya"
          aria-label="New person's name"
          aria-invalid={!!error}
          aria-describedby={error ? "add-person-error" : undefined}
          className={cn("h-10", error && "border-debit")}
        />
        <Button type="submit" className="shrink-0" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Stop adding people">
            <X />
          </Button>
        )}
      </div>
      {error && (
        <p id="add-person-error" className="text-sm text-debit">
          {error}
        </p>
      )}
    </form>
  );
};

/** First-run setup: add names one after another, then jump straight into the first expense. */
const QuickAddPeople = ({ spaceId, existingNames }: { spaceId: string; existingNames: string[] }) => {
  const refreshSpace = useRefreshSpace();
  const { openNew } = useExpenseComposer();
  const [name, setName] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    const taken = [...existingNames, ...added].find((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
    if (taken) {
      setError(`${taken} is already here. Add an initial to tell them apart, like “${trimmed} S”.`);
      return;
    }
    setSaving(true);
    try {
      await createPerson(spaceId, { name: trimmed, email: null, phone: null });
      setAdded((prev) => [...prev, trimmed]);
      setName("");
      setError(null);
      // The page refreshes on "Done", so this form stays put while names are added.
    } catch (err) {
      setError(errorMessage(err, "Couldn't add them. Try again."));
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2" noValidate>
        <Input
          ref={inputRef}
          autoFocus
          value={name}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Name, e.g. Priya"
          aria-label="Person's name"
          aria-invalid={!!error}
          className="h-11"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-debit">{error}</p>}
      {added.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Added so far">
          {added.map((n) => (
            <li key={n} className="inline-flex items-center gap-2 rounded-full bg-secondary py-1 pl-1 pr-3 text-sm font-medium">
              <PersonAvatar name={n} size="xs" /> {n}
            </li>
          ))}
        </ul>
      )}
      {added.length === 1 && (
        <p className="text-sm text-muted-foreground">Add one more person to start splitting.</p>
      )}
      {added.length >= 1 && (
        <Button
          variant={added.length >= 2 ? "default" : "outline"}
          onClick={async () => {
            await refreshSpace(spaceId);
            if (added.length >= 2) openNew();
          }}
        >
          {added.length >= 2 ? (
            <>
              Add your first expense <ArrowRight />
            </>
          ) : (
            "Done for now"
          )}
        </Button>
      )}
    </div>
  );
};

const HomeSkeleton = () => (
  <div className="mx-auto max-w-5xl" aria-busy="true" aria-label="Loading">
    <Skeleton className="mb-2 h-8 w-48" />
    <Skeleton className="mb-8 h-4 w-32" />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="space-y-6 lg:col-span-7">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl lg:col-span-5" />
    </div>
  </div>
);

export default Dashboard;
