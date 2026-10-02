import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Flame, RotateCw, Table2 } from "lucide-react";
import { toast } from "sonner";
import autoTable from "jspdf-autotable";
import type jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { InsightsTabs } from "@/components/InsightsTabs";
import { EmptyState } from "@/components/EmptyState";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ReportControls } from "@/components/ReportControls";
import { buildPeriodPresets } from "@/lib/periods";
import { ExpenseTrendGraph, type TrendPeriod } from "@/components/graphs/ExpenseTrendGraph";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useSpaceData } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { applyExpenseFilters, countActiveFilters, inRange } from "@/lib/expenseFilters";
import { errorMessage } from "@/lib/db";
import { formatMoney, formatRange, parseDateOnly, plural, toDateOnly } from "@/lib/format";
import {
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  drawBody,
  tableStyles,
  accentTableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";
import { cn } from "@/lib/utils";

const lastTableY = (doc: jsPDF, fallback: number) =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || fallback;

const PERIODS: { id: TrendPeriod; label: string }[] = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

export default function Analytics() {
  const { flatmates, expenses: allExpenses, categories, settlements, space, isLoading, error, refetch } = useSpaceData();
  const { meId } = useMe(flatmates);
  const { dateRange, peopleFilters, categoryFilters, setDateRange, setPeopleFilters, setCategoryFilters } =
    useReportFilters();
  // null = pick by range length, so one big day (rent on the 1st) doesn't flatten a long range.
  const [chosenPeriod, setGraphPeriod] = useState<TrendPeriod | null>(null);
  const [asTable, setAsTable] = useState(false);

  const presets = useMemo(() => buildPeriodPresets(allExpenses, settlements), [allExpenses, settlements]);
  const from = toDateOnly(dateRange.from);
  const to = toDateOnly(dateRange.to);
  const expenses = useMemo(
    () => applyExpenseFilters(inRange(allExpenses, from, to), peopleFilters, categoryFilters),
    [allExpenses, from, to, peopleFilters, categoryFilters]
  );
  const labelOf = (id: string) => (id === meId ? "You" : flatmates.find((f) => f.id === id)?.name ?? "Unknown");

  // Same figures the page and its PDF have always reported.
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const categoryTotals = [...categories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => {
      const categoryExpenses = expenses.filter((exp) => exp.category_id === category.id);
      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const percentage = expenses.length > 0 ? (total / totalExpenses) * 100 : 0;
      return { ...category, total, percentage, count: categoryExpenses.length };
    });
  const mostExpensiveCategory = categoryTotals.reduce(
    (max, cat) => (cat.total > max.total ? cat : max),
    categoryTotals[0] || { name: "N/A", total: 0 }
  );
  const uncategorized = expenses.filter((e) => !e.category_id || !categories.some((c) => c.id === e.category_id));
  const uncategorizedTotal = uncategorized.reduce((sum, e) => sum + e.amount, 0);

  const dailyTotals = expenses.reduce(
    (acc, exp) => {
      if (!acc[exp.date]) acc[exp.date] = { date: exp.date, total: 0, count: 0 };
      acc[exp.date].total += exp.amount;
      acc[exp.date].count += 1;
      return acc;
    },
    {} as Record<string, { date: string; total: number; count: number }>
  );
  const topDays = Object.values(dailyTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const avgPerDay = totalExpenses / daysDiff;
  const graphPeriod: TrendPeriod = chosenPeriod ?? (daysDiff <= 31 ? "day" : daysDiff <= 120 ? "week" : "month");
  const avgPerPerson = flatmates.length > 0 ? totalExpenses / flatmates.length : 0;

  // Only printed in the PDF export (unchanged); see the summary in the change notes.
  const personAmounts = flatmates.map((f) =>
    expenses.filter((exp) => exp.paid_by === f.id).reduce((sum, exp) => sum + exp.amount, 0)
  );
  const mean = personAmounts.reduce((sum, amt) => sum + amt, 0) / personAmounts.length || 1;
  const variance = personAmounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / personAmounts.length;
  const fairnessScore = Math.max(0, 100 - Math.sqrt(variance) * 10);

  const generateAnalyticsSummaryPDF = () => {
    try {
      const doc = createPdfDoc();
      const period = `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`;

      let y = drawPdfHeader(doc, {
        title: "Analytics Summary",
        subtitle: space ? space.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });
      y = drawBody(doc, `Period: ${period}`, y, { muted: true });
      y += 4;

      y = drawSectionTitle(doc, "Category Breakdown", y);

      const categoryData = categoryTotals
        .filter((cat) => cat.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((cat) => [cat.name, pdfAmount(cat.total), `${cat.percentage.toFixed(1)}%`, cat.count.toString()]);

      autoTable(doc, {
        ...tableStyles({
          startY: y + 2,
          head: [["Category", "Total", "%", "Count"]],
          body: categoryData,
          columnStyles: {
            1: { halign: "right", fontStyle: "bold" },
            2: { halign: "right" },
            3: { halign: "center" },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY = lastTableY(doc, y);

      let cursorY = drawSectionTitle(doc, "Key Insights", finalY + 14);
      cursorY = drawBody(doc, `Total expenses: ${pdfAmount(totalExpenses)}`, cursorY + 4);
      cursorY = drawBody(
        doc,
        `Most expensive category: ${mostExpensiveCategory.name} (${pdfAmount(mostExpensiveCategory.total)})`,
        cursorY
      );
      cursorY = drawBody(doc, `Average per day: ${pdfAmount(avgPerDay)}`, cursorY);
      cursorY = drawBody(doc, `Average per person: ${pdfAmount(avgPerPerson)}`, cursorY);
      cursorY = drawBody(doc, `Fairness score: ${fairnessScore.toFixed(1)}/100`, cursorY);

      if (topDays.length > 0) {
        cursorY = drawSectionTitle(doc, "Top 5 Most Expensive Days", cursorY + 8);
        const topDaysData = topDays.map((day, idx) => [
          `${idx + 1}`,
          format(parseDateOnly(day.date), "MMM d, yyyy"),
          pdfAmount(day.total),
          day.count.toString(),
        ]);
        autoTable(doc, {
          ...accentTableStyles({
            startY: cursorY + 2,
            head: [["#", "Date", "Total", "Expenses"]],
            body: topDaysData,
            columnStyles: {
              0: { halign: "center", cellWidth: 14 },
              2: { halign: "right", fontStyle: "bold" },
              3: { halign: "center" },
            },
            didDrawPage: () => drawPdfFooter(doc),
          }),
        });
      }

      drawPdfFooter(doc);
      doc.save(`analytics_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF");
    }
  };

  const ranked = categoryTotals.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const rows = [
    ...ranked.map((c) => ({ id: c.id, name: c.name, total: c.total, percentage: c.percentage, count: c.count })),
    ...(uncategorizedTotal > 0
      ? [
          {
            id: "none",
            name: "No category",
            total: uncategorizedTotal,
            percentage: (uncategorizedTotal / totalExpenses) * 100,
            count: uncategorized.length,
          },
        ]
      : []),
  ];
  const maxRow = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Insights"
        documentTitle="Spending"
        description={space ? `Where the money goes in ${space.name}` : "Where the money goes"}
        actions={
          !isLoading &&
          expenses.length > 0 && (
            <Button variant="outline" onClick={generateAnalyticsSummaryPDF}>
              <Download />
              Download PDF
            </Button>
          )
        }
      />
      <InsightsTabs />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={RotateCw}
          title="Couldn't load spending"
          action={<Button onClick={refetch}>Try again</Button>}
          className="rounded-2xl border bg-card"
        >
          {errorMessage(error)}
        </EmptyState>
      ) : (
        <>
          <ReportControls
            range={dateRange}
            onRangeChange={setDateRange}
            presets={presets}
            people={peopleFilters}
            onPeopleChange={setPeopleFilters}
            categoryFilters={categoryFilters}
            onCategoryChange={setCategoryFilters}
            flatmates={flatmates}
            categories={categories}
            labelOf={labelOf}
          />

          {expenses.length === 0 && allExpenses.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3 text-sm">
              <span>Nothing was spent in this period{countActiveFilters(peopleFilters, categoryFilters) > 0 ? " with these filters" : ""}.</span>
              {presets.quick.some((p) => p.id === "all") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDateRange(presets.quick.find((p) => p.id === "all")!.range)}
                >
                  Show all time
                </Button>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
            <Figure label="Spent" value={formatMoney(totalExpenses, { decimals: 0 })} note={plural(expenses.length, "expense")} />
            <Figure label="Per day" value={formatMoney(avgPerDay, { decimals: 0 })} note={`Over ${plural(daysDiff, "day")}`} />
            <Figure
              label="Average per person"
              value={formatMoney(avgPerPerson, { decimals: 0 })}
              note={`Total ÷ ${plural(flatmates.length, "person", "people")}`}
            />
            <Figure
              label="Biggest category"
              value={ranked[0]?.name ?? "None"}
              note={ranked[0] ? `${formatMoney(ranked[0].total, { decimals: 0 })} · ${ranked[0].percentage.toFixed(0)}%` : "No spending yet"}
            />
          </dl>

          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Spending over time</h2>
                <p className="text-sm text-muted-foreground">{formatRange(dateRange.from, dateRange.to)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg bg-secondary p-0.5" role="group" aria-label="Group by">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setGraphPeriod(p.id)}
                      aria-pressed={graphPeriod === p.id}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                        graphPeriod === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant={asTable ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8"
                  onClick={() => setAsTable((t) => !t)}
                  aria-pressed={asTable}
                  title={asTable ? "Show chart" : "Show as table"}
                >
                  <Table2 className="size-4" />
                  <span className="sr-only">{asTable ? "Show chart" : "Show as table"}</span>
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <ExpenseTrendGraph
                expenses={expenses.map((e) => ({ date: e.date, amount: e.amount }))}
                period={graphPeriod}
                range={dateRange}
                asTable={asTable}
              />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <section className="rounded-2xl border bg-card p-5 sm:p-6">
              <h2 className="font-semibold">By category</h2>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No spending in this period.</p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <CategoryIcon name={r.id === "none" ? null : r.name} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{r.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.total, { decimals: 0 })}</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-secondary">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.max((r.total / maxRow) * 100, 1.5)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {r.percentage.toFixed(1)}% · {plural(r.count, "expense")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Flame className="size-4 text-muted-foreground" />
                Biggest days
              </h2>
              {topDays.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No spending in this period.</p>
              ) : (
                <ol className="mt-2 divide-y">
                  {topDays.map((day, idx) => (
                    <li key={day.date} className="flex items-center gap-3 py-3">
                      <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{format(parseDateOnly(day.date), "EEE, MMM d, yyyy")}</div>
                        <div className="text-xs text-muted-foreground">{plural(day.count, "expense")}</div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(day.total, { decimals: 0 })}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

const Figure = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="min-w-0 bg-card px-4 py-3.5 sm:px-5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 truncate text-lg font-semibold sm:text-xl">{value}</dd>
    <dd className="truncate text-xs text-muted-foreground">{note}</dd>
  </div>
);
