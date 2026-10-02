import { useMemo, useState } from "react";
import { differenceInCalendarDays, max as maxDate, min as minDate, startOfDay } from "date-fns";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Panel, Section } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import { ActiveFiltersNotice, FiltersButton, FiltersPanel } from "@/components/filters/FiltersPanel";
import { ExpenseTrendGraph, type TrendPeriod } from "@/components/graphs/ExpenseTrendGraph";
import { StatTile } from "@/components/insights/StatTile";
import {
  InsightsError,
  InsightsHeader,
  InsightsNoExpenses,
  InsightsNoGroup,
  InsightsNoPeople,
  InsightsPage,
  InsightsSkeleton,
} from "@/components/insights/InsightsChrome";
import {
  biggestDays,
  categoryBreakdown,
  formatPercent,
  sumAmounts,
  type CategoryTotal,
  type DayTotal,
} from "@/components/insights/insightMath";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useSpaceData } from "@/hooks/useSpaceData";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useSettleView } from "@/hooks/useSettleView";
import type { DateRange } from "@/lib/expenseFilters";
import { formatDay, formatMoney, formatMoneyCompact, parseDay, pluralize } from "@/lib/format";
import { generateAnalyticsSummaryPDF } from "@/lib/insightExports";
import { cn } from "@/lib/utils";

const TREND_PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export default function Analytics() {
  const { selectedSplitSpace, splitSpaces, loading: spacesLoading } = useSplitSpace();
  const { people, expenses, settlements, categories, isLoading, error, refetch } = useSpaceData(
    selectedSplitSpace?.id
  );
  const {
    dateRange,
    datePreset,
    peopleFilters,
    categoryFilters,
    setDateRange,
    setDatePreset,
    setPeopleFilters,
    setCategoryFilters,
    resetFilters,
  } = useReportFilters();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("day");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const hasSettlements = settlements.length > 0;
  // Same period and filter resolution as Settle up, including ignoring stored
  // filter IDs (people from another group, deleted categories) that don't apply here.
  const { range, inPeriod, filtered, activeFilters: filterCount } = useSettleView({
    people,
    expenses,
    settlements,
    preset: datePreset,
    customRange: dateRange,
    peopleFilters,
    categoryFilters,
    categories,
  });

  const total = useMemo(() => sumAmounts(filtered), [filtered]);
  const { days, soFar } = useMemo(() => perDaySpan(range, inPeriod), [range, inPeriod]);
  const perDay = total / days;
  const perPerson = people.length > 0 ? total / people.length : 0;
  const byCategory = useMemo(() => categoryBreakdown(filtered, categories), [filtered, categories]);
  const topCategory = byCategory.find((c) => !c.uncategorised && c.total > 0) ?? null;
  const topDays = useMemo(() => biggestDays(filtered, 5), [filtered]);

  const ready = !spacesLoading && !isLoading && !error && !!selectedSplitSpace;

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      // Let the button show its busy state before the (synchronous) build runs.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const fileName = generateAnalyticsSummaryPDF({
        spaceName: selectedSplitSpace?.name,
        range,
        categoryTotals: byCategory,
        totalExpenses: total,
        mostExpensiveCategory: topCategory ?? { name: "N/A", total: 0 },
        avgPerDay: perDay,
        avgPerPerson: perPerson,
        topDays,
      });
      toast.success("Downloaded the spending summary", { description: fileName });
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
      canDownload={ready && people.length > 0}
    />
  );

  if (spacesLoading || (isLoading && !error)) {
    return (
      <InsightsPage>
        {header}
        <InsightsSkeleton variant="spending" />
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
          title="No spending to show yet"
          description="Add your first shared expense and this page fills in with totals, trends and categories."
        />
      </InsightsPage>
    );
  }

  return (
    <InsightsPage>
      {header}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <PeriodPicker
          className="min-w-0 flex-1"
          preset={datePreset}
          onPresetChange={setDatePreset}
          range={range}
          onCustomRangeChange={setDateRange}
          hasSettlements={hasSettlements}
        />
        <FiltersButton count={filterCount} onClick={() => setFiltersOpen(true)} className="self-start" />
      </div>

      <ActiveFiltersNotice
        count={filterCount}
        shown={filtered.length}
        total={inPeriod.length}
        onEdit={() => setFiltersOpen(true)}
        onClear={resetFilters}
        consequence="These insights only count those."
      />

      <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", filterCount > 0 && "mt-4")}>
        <StatTile label="Total spent" value={formatMoneyCompact(total)} sub={pluralize(filtered.length, "expense")} />
        <StatTile
          label="Per day"
          value={formatMoney(perDay, { decimals: 0 })}
          sub={`over ${pluralize(days, "day")}${soFar ? " so far" : ""}`}
        />
        <StatTile
          label="Per person"
          value={formatMoney(perPerson, { decimals: 0 })}
          sub={pluralize(people.length, "person", "people")}
        />
        <StatTile
          label="Top category"
          value={topCategory ? topCategory.name : "—"}
          sub={
            topCategory
              ? `${formatMoneyCompact(topCategory.total)} · ${formatPercent(topCategory.percentage)}`
              : filtered.length > 0
                ? "Nothing categorised"
                : undefined
          }
        />
      </dl>

      {filtered.length === 0 ? (
        <Panel className="mt-6">
          <EmptyState
            compact
            title="No spending in this period."
            description={
              filterCount > 0
                ? "Your filters hide every expense from this period."
                : datePreset === "since-settlement" && hasSettlements
                  ? "Nothing has been added since the last settle-up. Pick another period to look back."
                  : "Pick a different period to see where the money went."
            }
            action={
              filterCount > 0 ? (
                <Button variant="outline" onClick={resetFilters}>
                  <X /> Clear filters
                </Button>
              ) : datePreset !== "all-time" ? (
                <Button variant="outline" onClick={() => setDatePreset("all-time")}>
                  Show all time
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <Section title="Spending over time" className="lg:col-span-5">
            <Panel>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {trendPeriod === "day" ? "Per day" : trendPeriod === "week" ? "Per week, from Sunday" : "Per month"}
                </p>
                <ToggleGroup
                  type="single"
                  value={trendPeriod}
                  onValueChange={(value) => value && setTrendPeriod(value as TrendPeriod)}
                  aria-label="Group spending by"
                  className="gap-0.5 rounded-lg border bg-background p-0.5"
                >
                  {TREND_PERIODS.map((p) => (
                    <ToggleGroupItem
                      key={p.value}
                      value={p.value}
                      className="h-10 rounded-md px-3 text-[13px] hover:bg-secondary hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                    >
                      {p.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <ExpenseTrendGraph expenses={filtered} period={trendPeriod} />
            </Panel>
          </Section>

          <Section title="By category" className="lg:col-span-3">
            <Panel>
              <CategoryBars rows={byCategory} />
            </Panel>
          </Section>

          <Section title="Biggest days" className="lg:col-span-2">
            <Panel>
              <BiggestDays days={topDays} />
            </Panel>
          </Section>
        </div>
      )}

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
        matchCount={filtered.length}
        description="Choose which expenses these insights count. Settle up uses the same filters."
      />
    </InsightsPage>
  );
}

/**
 * Days to average over: the whole period, except that a period still running
 * (e.g. "This month") only counts the days up to today, or up to its latest
 * expense if one is dated later.
 */
const perDaySpan = (range: DateRange, inPeriod: { date: string }[]) => {
  const today = startOfDay(new Date());
  let end = range.to;
  if (end > today) {
    const latest = inPeriod.reduce<string | null>((max, e) => (max === null || e.date > max ? e.date : max), null);
    const elapsed = maxDate([today, latest ? parseDay(latest) : today]);
    // A period that hasn't started yet keeps its full length.
    if (elapsed >= startOfDay(range.from)) end = minDate([range.to, elapsed]);
  }
  const fullDays = differenceInCalendarDays(range.to, range.from) + 1;
  const days = Math.max(1, differenceInCalendarDays(end, range.from) + 1);
  return { days, soFar: days < fullDays };
};

// One hue, stepping down in strength as categories get smaller.
const BAR_TONES = ["bg-primary", "bg-primary/80", "bg-primary/65", "bg-primary/50"];
const barTone = (rank: number, uncategorised: boolean) =>
  uncategorised ? "bg-muted-foreground/40" : BAR_TONES[Math.min(rank, BAR_TONES.length - 1)];

const CategoryBars = ({ rows }: { rows: CategoryTotal[] }) => {
  let rank = 0;
  return (
    <ul className="divide-y divide-border/70">
      {rows.map((row) => {
        const tone = barTone(rank, row.uncategorised);
        if (!row.uncategorised) rank += 1;
        return (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "min-w-0 truncate text-[15px] font-medium",
                  row.uncategorised && "text-muted-foreground"
                )}
              >
                {row.name}
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoneyCompact(row.total)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div
                className={cn("h-full rounded-full", tone)}
                style={{ width: `${Math.max(row.percentage, row.total > 0 ? 1 : 0)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">
              {formatPercent(row.percentage)} · {pluralize(row.count, "expense")}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

const describeTitles = (titles: string[]) => {
  if (titles.length <= 2) return titles.join(", ");
  return `${titles.slice(0, 2).join(", ")} +${titles.length - 2} more`;
};

const BiggestDays = ({ days }: { days: DayTotal[] }) => (
  <ol className="divide-y divide-border/70">
    {days.map((day, index) => (
      <li key={day.date} className="flex min-h-14 items-center gap-3 py-3 first:pt-0 last:pb-0">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            index === 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
          )}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{formatDay(day.date, "EEE, d MMM yyyy")}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {pluralize(day.count, "expense")} · {describeTitles(day.titles)}
          </p>
        </div>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoneyCompact(day.total)}</span>
      </li>
    ))}
  </ol>
);
