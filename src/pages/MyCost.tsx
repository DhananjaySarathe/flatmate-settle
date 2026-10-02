import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import { ActiveFiltersNotice } from "@/components/filters/FiltersPanel";
import { PersonSheet } from "@/components/people/PersonSheet";
import { DateRangeFields } from "@/components/insights/DateRangeFields";
import {
  InsightsError,
  InsightsHeader,
  InsightsNoExpenses,
  InsightsNoGroup,
  InsightsNoPeople,
  InsightsPage,
  InsightsSkeleton,
} from "@/components/insights/InsightsChrome";
import { calculateCosts, type PersonCost } from "@/components/insights/insightMath";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useSpaceData } from "@/hooks/useSpaceData";
import { useMyCostFilters, type MyCostDatePreset } from "@/hooks/useMyCostFilters";
import {
  EMPTY_CATEGORY_FILTERS,
  EMPTY_PEOPLE_FILTERS,
  applyPeopleAndCategoryFilters,
  filterByDateRange,
  scopeFilters,
} from "@/lib/expenseFilters";
import { calculateBalances, type Settlement } from "@/lib/settlement";
import { formatMoney, formatMoneyCompact, formatRange, parseDay, pluralize } from "@/lib/format";
import { generateCostReportPDF } from "@/lib/insightExports";
import { cn } from "@/lib/utils";

const SETTLEMENT_PREFIX = "settlement:";
const NO_PAYMENTS: Settlement[] = [];

export default function MyCost() {
  const { selectedSplitSpace, splitSpaces, loading: spacesLoading } = useSplitSpace();
  const { people, expenses, settlements, categories, isLoading, error, refetch } = useSpaceData(
    selectedSplitSpace?.id
  );
  const {
    datePreset,
    dateRange,
    categoryFilters,
    setDatePreset,
    setDateRange,
    applySettlementRange,
    setCategoryFilters,
  } = useMyCostFilters();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sheetPersonId, setSheetPersonId] = useState<string | null>(null);

  const loaded = !spacesLoading && !isLoading && !error && !!selectedSplitSpace;

  // A settle-up preset belongs to one group and can be removed; fall back to All time.
  const presetSettlement = datePreset.startsWith(SETTLEMENT_PREFIX)
    ? settlements.find((s) => s.id === datePreset.slice(SETTLEMENT_PREFIX.length)) ?? null
    : null;
  const presetIsStale = datePreset.startsWith(SETTLEMENT_PREFIX) && !presetSettlement;
  const activePreset: MyCostDatePreset = presetIsStale ? "all-time" : datePreset;

  useEffect(() => {
    if (loaded && presetIsStale) setDatePreset("all-time");
  }, [loaded, presetIsStale, setDatePreset]);

  // A settle-up preset always uses that settle-up's own days. The stored copy can
  // be a day off: older versions saved it from new Date("yyyy-MM-dd"), i.e. UTC midnight.
  const range = useMemo(
    () =>
      presetSettlement
        ? { from: parseDay(presetSettlement.from_date), to: parseDay(presetSettlement.to_date) }
        : dateRange,
    [presetSettlement, dateRange]
  );

  const inPeriod = useMemo(
    () => (activePreset === "all-time" ? expenses : filterByDateRange(expenses, range)),
    [activePreset, expenses, range]
  );
  // A saved filter can point at a category that has since been deleted; ignore those ids.
  const activeCategoryFilters = useMemo(
    () =>
      scopeFilters(EMPTY_PEOPLE_FILTERS, categoryFilters, {
        personIds: [],
        categoryIds: categories.map((c) => c.id),
      }).categories,
    [categories, categoryFilters]
  );
  const filtered = useMemo(
    () => applyPeopleAndCategoryFilters(inPeriod, EMPTY_PEOPLE_FILTERS, activeCategoryFilters),
    [inPeriod, activeCategoryFilters]
  );
  const categoryFilterCount = activeCategoryFilters.include.length + activeCategoryFilters.exclude.length;

  const costs = useMemo(() => calculateCosts(people, filtered), [people, filtered]);
  const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);
  const average = costs.length > 0 ? totalCost / costs.length : 0;
  const largestShare = costs[0]?.totalCost ?? 0;

  const balances = useMemo(() => calculateBalances(people, filtered), [people, filtered]);
  const nameOf = useMemo(() => {
    const names = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => names.get(id) ?? "Someone";
  }, [people]);

  const periodLabel =
    activePreset === "all-time"
      ? "All time"
      : presetSettlement
        ? `Settle-up of ${formatRange(range.from, range.to)}`
        : formatRange(range.from, range.to);
  // The PDF keeps its original wording.
  const pdfPeriodLabel =
    activePreset === "all-time"
      ? "All time"
      : `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;

  const handlePresetChange = (value: string) => {
    if (value === "all-time" || value === "custom") {
      setDatePreset(value);
      return;
    }
    if (value.startsWith(SETTLEMENT_PREFIX)) {
      const settlement = settlements.find((s) => s.id === value.slice(SETTLEMENT_PREFIX.length));
      if (settlement) {
        applySettlementRange(settlement.id, parseDay(settlement.from_date), parseDay(settlement.to_date));
      }
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const fileName = generateCostReportPDF({
        spaceName: selectedSplitSpace?.name,
        periodLabel: pdfPeriodLabel,
        personCosts: costs,
        expenseCount: filtered.length,
      });
      toast.success("Downloaded the cost report", { description: fileName });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF", { description: "Try again. If it keeps failing, reload the page." });
    } finally {
      setPdfBusy(false);
    }
  };

  const header = (
    <InsightsHeader
      onDownload={downloadPdf}
      downloading={pdfBusy}
      canDownload={loaded && costs.length > 0}
      caption="Each person's share of the expenses they're part of."
    />
  );

  if (spacesLoading || (isLoading && !error)) {
    return (
      <InsightsPage>
        {header}
        <InsightsSkeleton variant="list" />
      </InsightsPage>
    );
  }

  if (!selectedSplitSpace) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoGroup hasGroups={splitSpaces.length > 0} />
      </InsightsPage>
    );
  }

  if (error) {
    return (
      <InsightsPage>
        {header}
        <InsightsError error={error} onRetry={() => refetch()} />
      </InsightsPage>
    );
  }

  if (people.length === 0) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoPeople />
      </InsightsPage>
    );
  }

  if (expenses.length === 0) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoExpenses
          title="No expenses yet"
          description="Once you add shared expenses, you'll see what each person's share comes to."
        />
      </InsightsPage>
    );
  }

  const sheetPerson = people.find((p) => p.id === sheetPersonId) ?? null;

  return (
    <InsightsPage>
      {header}

      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={activePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-10 w-full bg-card sm:w-80" aria-label="Period">
              <SelectValue placeholder="Choose a period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-time">All time</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
              {settlements.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-xs font-medium text-muted-foreground">Past settle-ups</SelectLabel>
                    {settlements.map((s) => (
                      <SelectItem key={s.id} value={`${SETTLEMENT_PREFIX}${s.id}`}>
                        {formatRange(parseDay(s.from_date), parseDay(s.to_date))}
                        {s.note ? ` · ${s.note}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Button variant="outline" onClick={() => setCategoriesOpen(true)} className="self-start sm:self-auto">
              <SlidersHorizontal />
              Categories
              {categoryFilterCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {categoryFilterCount}
                </span>
              )}
            </Button>
          )}
        </div>
        {activePreset === "custom" && <DateRangeFields range={dateRange} onChange={setDateRange} />}
      </div>

      <ActiveFiltersNotice
        count={categoryFilterCount}
        shown={filtered.length}
        total={inPeriod.length}
        onEdit={() => setCategoriesOpen(true)}
        onClear={() => setCategoryFilters(EMPTY_CATEGORY_FILTERS)}
        consequence="Shares only count these."
      />

      <Panel className={cn("p-0 sm:p-0", categoryFilterCount > 0 && "mt-4")}>
        <div className="border-b px-4 py-3.5 sm:px-5">
          <h2 className="sr-only">Share per person</h2>
          <p className="text-[15px] leading-snug">
            <span className="font-semibold tabular-nums">{formatMoneyCompact(totalCost)}</span> shared by{" "}
            {pluralize(costs.length, "person", "people")}
            <span className="text-muted-foreground">
              {" "}
              · average <span className="tabular-nums">{formatMoneyCompact(average)}</span> ·{" "}
              {pluralize(filtered.length, "expense")}
            </span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{periodLabel}</p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            compact
            title="No expenses in this period."
            description={
              categoryFilterCount > 0
                ? "Your category filter hides every expense from this period."
                : "Try a longer period to see everyone's share."
            }
            action={
              <>
                {categoryFilterCount > 0 && (
                  <Button variant="outline" onClick={() => setCategoryFilters(EMPTY_CATEGORY_FILTERS)}>
                    <X /> Clear categories
                  </Button>
                )}
                {activePreset !== "all-time" && (
                  <Button variant="outline" onClick={() => setDatePreset("all-time")}>
                    Show all time
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-border/70 px-2 py-1 sm:px-3">
            {costs.map((cost) => (
              <CostRow
                key={cost.id}
                cost={cost}
                largestShare={largestShare}
                onSelect={() => setSheetPersonId(cost.id)}
              />
            ))}
          </ul>
        )}
      </Panel>

      <ResponsiveDialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Categories</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Choose which expenses count towards each share.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <CategoryFilterSection
              categories={categories}
              categoryFilters={categoryFilters}
              setCategoryFilters={setCategoryFilters}
            />
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCategoryFilters(EMPTY_CATEGORY_FILTERS)}
              disabled={categoryFilterCount === 0}
            >
              Clear
            </Button>
            <Button onClick={() => setCategoriesOpen(false)}>Show {pluralize(filtered.length, "expense")}</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Read-only: no payment plan here, since a past period may already be settled. */}
      <PersonSheet
        open={!!sheetPerson}
        onOpenChange={(open) => !open && setSheetPersonId(null)}
        spaceId={selectedSplitSpace.id}
        spaceName={selectedSplitSpace.name}
        person={sheetPerson}
        balance={balances.find((b) => b.id === sheetPersonId) ?? null}
        settlements={NO_PAYMENTS}
        periodExpenses={filtered}
        allExpenses={expenses}
        periodLabel={periodLabel}
        nameOf={nameOf}
        readOnly
      />
    </InsightsPage>
  );
}

const CostRow = ({
  cost,
  largestShare,
  onSelect,
}: {
  cost: PersonCost;
  largestShare: number;
  onSelect: () => void;
}) => {
  const width = largestShare > 0 ? (cost.totalCost / largestShare) * 100 : 0;
  const involved = cost.expenseCount > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${cost.name}: share ${formatMoney(cost.totalCost)} across ${pluralize(
          cost.expenseCount,
          "expense"
        )}. Show details`}
        className="flex min-h-16 w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PersonAvatar name={cost.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[15px] font-medium">{cost.name}</p>
            <span
              className={cn(
                "shrink-0 text-[15px] font-semibold tabular-nums",
                !involved && "font-medium text-muted-foreground"
              )}
            >
              {formatMoneyCompact(cost.totalCost)}
            </span>
          </div>
          <p className="truncate text-[13px] text-muted-foreground">
            {involved ? `in ${pluralize(cost.expenseCount, "expense")}` : "Not in any expense this period"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );
};
