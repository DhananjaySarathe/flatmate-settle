import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, Panel, Section } from "@/components/common/PageHeader";
import { SettlementPlan } from "@/components/common/SettlementPlan";
import { BalanceList } from "@/components/common/BalanceList";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import { ActiveFiltersNotice, FiltersButton, FiltersPanel } from "@/components/filters/FiltersPanel";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { PersonSheet } from "@/components/people/PersonSheet";
import { MarkSettledDialog } from "@/components/settle/MarkSettledDialog";
import { ShareLinkDialog } from "@/components/settle/ShareLinkDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseComposer } from "@/contexts/ExpenseComposerContext";
import { useRefreshSpace, useSpaceData, type Person, type SavedSettlement } from "@/hooks/useSpaceData";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useSettleView } from "@/hooks/useSettleView";
import { presetLabel } from "@/lib/expenseFilters";
import { buildAllExpensesText, buildSettlementSummaryText, type ExportInput } from "@/lib/reportText";
import { copyText } from "@/lib/clipboard";
import { db, errorMessage } from "@/lib/db";
import { formatDay, formatMoney, formatRange, parseDay, pluralize, toDayKey } from "@/lib/format";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc" | "title-desc";

const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
};

const LIST_PREVIEW = 8;

export default function Reports() {
  const { selectedSplitSpace, loading: spacesLoading } = useSplitSpace();
  const spaceId = selectedSplitSpace?.id;
  const {
    people,
    expenses: allExpenses,
    categories,
    settlements: savedSettlements,
    isLoading,
    error,
    refetch,
  } = useSpaceData(spaceId);
  const { openNew, openDetail } = useExpenseComposer();
  const refreshSpace = useRefreshSpace();
  const {
    dateRange: customRange,
    datePreset,
    peopleFilters,
    categoryFilters,
    setDateRange,
    setDatePreset,
    setPeopleFilters,
    setCategoryFilters,
    resetFilters,
  } = useReportFilters();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"summary" | "expenses" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<SavedSettlement | null>(null);
  const [sheetPersonId, setSheetPersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const view = useSettleView({
    people,
    expenses: allExpenses,
    settlements: savedSettlements,
    preset: datePreset,
    customRange,
    peopleFilters,
    categoryFilters,
    categories,
  });
  const { range, inPeriod, filtered: expenses, balances, plan, total, activeFilters, zeroSplit } = view;
  const transfer = view.transferTotal;
  const sortedBalances = useMemo(() => [...balances].sort((a, b) => b.balance - a.balance), [balances]);

  const sortedExpenses = useMemo(() => {
    const list = [...expenses];
    switch (sortBy) {
      case "date-asc":
        return list.sort((a, b) => a.date.localeCompare(b.date));
      case "amount-desc":
        return list.sort((a, b) => b.amount - a.amount);
      case "amount-asc":
        return list.sort((a, b) => a.amount - b.amount);
      case "title-asc":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc":
        return list.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return list.sort((a, b) => b.date.localeCompare(a.date));
    }
  }, [expenses, sortBy]);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "Someone";
  }, [people]);

  const hasSettlements = savedSettlements.length > 0;
  const periodText = formatRange(range.from, range.to);
  const sheetPerson = people.find((p) => p.id === sheetPersonId) ?? null;

  const exportInput: ExportInput = {
    spaceName: selectedSplitSpace?.name,
    range,
    people,
    expenses: sortedExpenses,
    balances,
    settlements: plan,
  };

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) toast.success(`${what} copied`, { description: "Paste it wherever you like." });
    else toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
  };

  const runPdf = async (kind: "summary" | "expenses") => {
    setPdfBusy(kind);
    try {
      // jsPDF is loaded on first use; this also lets the spinner paint first.
      const { downloadAllExpensesPdf, downloadSettlementPdf } = await import("@/lib/reportExports");
      if (kind === "summary") downloadSettlementPdf(exportInput);
      else downloadAllExpensesPdf(exportInput);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  const deleteSavedSettlement = async () => {
    if (!settlementToDelete || !spaceId) return;
    const { error: deleteError } = await db.from("settlements").delete().eq("id", settlementToDelete.id);
    if (deleteError) {
      toast.error("Couldn't delete it", { description: deleteError.message });
      throw deleteError;
    }
    toast.success("Settle-up record deleted");
    await refreshSpace(spaceId);
  };

  if (spacesLoading || (isLoading && !error)) return <SettleSkeleton />;

  if (error) {
    return <ErrorState description={errorMessage(error, "Check your connection and try again.")} onRetry={() => refetch()} />;
  }

  if (!selectedSplitSpace || people.length === 0) {
    return (
      <>
        <PageHeader title="Settle up" />
        <EmptyState
          icon={Users}
          title="Add people to start settling up"
          description="Once people are added and expenses logged, this page shows exactly who pays whom."
          action={
            <Button asChild>
              <Link to="/dashboard" state={{ addPerson: true }}>
                <Plus /> Add people
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  const listed = showAllExpenses ? sortedExpenses : sortedExpenses.slice(0, LIST_PREVIEW);

  return (
    <div>
      <PageHeader
        title="Settle up"
        description="See who pays whom for a period, share it, then mark it settled."
        actions={
          <>
            <FiltersButton count={activeFilters} onClick={() => setFiltersOpen(true)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!!pdfBusy}>
                  {pdfBusy ? <Loader2 className="animate-spin" /> : <Share2 />}
                  Share & export
                  <ChevronDown className="opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{periodText}</DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-2 py-2"
                  disabled={plan.length === 0}
                  onSelect={() => copy(buildSettlementSummaryText(exportInput), "Summary")}
                >
                  <Copy className="h-4 w-4" /> Copy settle-up summary
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 py-2"
                  disabled={expenses.length === 0}
                  onSelect={() => copy(buildAllExpensesText(exportInput), "Expense list")}
                >
                  <Copy className="h-4 w-4" /> Copy all expenses
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 py-2"
                  disabled={expenses.length === 0}
                  onSelect={() => setShareOpen(true)}
                >
                  <LinkIcon className="h-4 w-4" /> Create public link…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => runPdf("summary")}>
                  <FileText className="h-4 w-4" /> Settlement report (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => runPdf("expenses")}>
                  <Download className="h-4 w-4" /> Expense list (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-4">
        <PeriodPicker
          preset={datePreset}
          onPresetChange={setDatePreset}
          range={range}
          onCustomRangeChange={setDateRange}
          hasSettlements={hasSettlements}
        />
        <ActiveFiltersNotice
          count={activeFilters}
          shown={expenses.length}
          total={inPeriod.length}
          onEdit={() => setFiltersOpen(true)}
          onClear={resetFilters}
          consequence="Balances and payments below only count these."
        />
        {zeroSplit.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-debit/25 bg-debit-soft px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-debit" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              {zeroSplit.length === 1
                ? `“${zeroSplit[0].title}” has nobody in its split, so ${nameOf(zeroSplit[0].paid_by)} is credited the full ${formatMoney(zeroSplit[0].amount)}.`
                : `${zeroSplit.length} expenses have nobody in their split, so their payers are credited in full.`}
            </p>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => openDetail(zeroSplit[0])}>
              Review
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="space-y-6 lg:col-span-3">
          <Panel>
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Who pays whom</h2>
              <p className="text-sm text-muted-foreground">
                {presetLabel(datePreset, hasSettlements)} · {periodText}
              </p>
            </div>
            {expenses.length === 0 ? (
              <EmptyState
                compact
                title={activeFilters > 0 ? "No expenses match your filters" : "No expenses in this period"}
                description={
                  activeFilters > 0
                    ? "Your filters hide everything here. Clear them or pick another period."
                    : "Pick another period, or add an expense."
                }
                action={
                  activeFilters > 0 ? (
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => openNew()}>
                      <Plus /> Add expense
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <SettlementPlan settlements={plan} />
                <div className="mt-4 flex flex-col gap-3 border-t pt-4 xl:flex-row xl:items-center xl:justify-between">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {plan.length > 0
                      ? `${pluralize(plan.length, "payment")} · ${formatMoney(transfer)} changes hands`
                      : `${pluralize(expenses.length, "expense")} · ${formatMoney(total)} spent`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {plan.length > 0 && (
                      <Button variant="outline" onClick={() => copy(buildSettlementSummaryText(exportInput), "Summary")}>
                        <Copy /> Copy
                      </Button>
                    )}
                    <Button
                      variant={plan.length > 0 ? "default" : "outline"}
                      onClick={() => setMarkOpen(true)}
                    >
                      <Check /> Mark as settled
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Section
            title="Balances"
            description={`Paid minus share, for ${pluralize(expenses.length, "expense")} (${formatMoney(total)}).`}
          >
            <Panel className="py-2 sm:py-2">
              <BalanceList balances={sortedBalances} onSelect={(b) => setSheetPersonId(b.id)} />
            </Panel>
          </Section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Expenses in this period"
            description={`${pluralize(expenses.length, "expense")} · ${formatMoney(total)}`}
            action={
              expenses.length > 1 && (
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[9.5rem] bg-card text-sm" aria-label="Sort expenses">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {SORT_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
          >
            {expenses.length === 0 ? (
              <Panel>
                <p className="text-sm text-muted-foreground">Nothing to show.</p>
              </Panel>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-card">
                <ul className="divide-y">
                  {listed.map((expense) => (
                    <li key={expense.id}>
                      <ExpenseRow
                        expense={expense}
                        nameOf={nameOf}
                        peopleCount={people.length}
                        onOpen={openDetail}
                        compact
                        className="px-4 sm:px-4"
                      />
                    </li>
                  ))}
                </ul>
                {sortedExpenses.length > LIST_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllExpenses((v) => !v)}
                    className="w-full border-t px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {showAllExpenses ? "Show fewer" : `Show all ${sortedExpenses.length}`}
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section title="Past settle-ups" description="Periods you've marked as settled.">
            {savedSettlements.length === 0 ? (
              <Panel>
                <p className="text-sm text-muted-foreground">
                  None yet. When everyone has paid, use “Mark as settled” so the next settle-up starts fresh.
                </p>
              </Panel>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
                {savedSettlements.map((s) => {
                  const viewing =
                    datePreset === "custom" &&
                    toDayKey(customRange.from) === s.from_date &&
                    toDayKey(customRange.to) === s.to_date;
                  return (
                    <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium tabular-nums">
                          {formatRange(parseDay(s.from_date), parseDay(s.to_date))}
                        </p>
                        {s.note && <p className="mt-0.5 break-words text-sm text-muted-foreground">{s.note}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground">Marked {formatDay(s.created_at.slice(0, 10))}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant={viewing ? "secondary" : "ghost"}
                          className="h-8"
                          disabled={viewing}
                          onClick={() => setDateRange({ from: parseDay(s.from_date), to: parseDay(s.to_date) })}
                        >
                          {viewing ? "Viewing" : "View"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-debit"
                          onClick={() => setSettlementToDelete(s)}
                          aria-label={`Delete settle-up ${formatRange(parseDay(s.from_date), parseDay(s.to_date))}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <FiltersPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        people={people}
        categories={categories}
        peopleFilters={peopleFilters}
        categoryFilters={categoryFilters}
        onPeopleFiltersChange={setPeopleFilters}
        onCategoryFiltersChange={setCategoryFilters}
        onClear={resetFilters}
        matchCount={expenses.length}
        description="Settle up for just some people or categories. Balances and payments only count matching expenses."
      />

      <MarkSettledDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        spaceId={selectedSplitSpace.id}
        range={range}
        settlements={plan}
        filtersActive={activeFilters > 0}
      />

      <ConfirmDialog
        open={!!settlementToDelete}
        onOpenChange={(open) => !open && setSettlementToDelete(null)}
        title="Delete this settle-up record?"
        description={
          <p>
            Expenses stay as they are. “Since last settle-up” will start after your previous record instead.
          </p>
        }
        confirmLabel="Delete record"
        destructive
        onConfirm={deleteSavedSettlement}
      />

      <ShareLinkDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        space={selectedSplitSpace}
        snapshotInput={{
          splitSpaceName: selectedSplitSpace.name,
          dateRange: { from: toDayKey(range.from), to: toDayKey(range.to) },
          balances,
          settlements: plan,
          expenses: sortedExpenses,
          flatmates: people,
        }}
      />

      <PersonSheet
        open={!!sheetPerson}
        onOpenChange={(open) => !open && setSheetPersonId(null)}
        spaceId={selectedSplitSpace.id}
        spaceName={selectedSplitSpace.name}
        person={sheetPerson}
        balance={balances.find((b) => b.id === sheetPersonId) ?? null}
        settlements={plan}
        periodExpenses={expenses}
        allExpenses={allExpenses}
        periodLabel={periodText}
        nameOf={nameOf}
        onEdit={(p) => {
          setSheetPersonId(null);
          setEditingPerson(p);
        }}
      />
      <PersonFormDialog
        open={!!editingPerson}
        onOpenChange={(open) => !open && setEditingPerson(null)}
        spaceId={selectedSplitSpace.id}
        spaceName={selectedSplitSpace.name}
        person={editingPerson}
        existingNames={people.map((p) => p.name)}
      />
    </div>
  );
}

const SettleSkeleton = () => (
  <div aria-busy="true" aria-label="Loading">
    <Skeleton className="mb-2 h-8 w-40" />
    <Skeleton className="mb-8 h-4 w-72" />
    <div className="mb-6 flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-full" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
      <Skeleton className="h-72 rounded-xl lg:col-span-3" />
      <Skeleton className="h-72 rounded-xl lg:col-span-2" />
    </div>
  </div>
);
