import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, Download, RotateCw, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import autoTable from "jspdf-autotable";
import type jsPDF from "jspdf";
import type { DateRange as PickerRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { InsightsTabs } from "@/components/InsightsTabs";
import { EmptyState } from "@/components/EmptyState";
import { PersonAvatar } from "@/components/PersonAvatar";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import { useMyCostFilters } from "@/hooks/useMyCostFilters";
import { useSpaceData } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { applyExpenseFilters, EMPTY_CATEGORY_FILTERS, EMPTY_PEOPLE_FILTERS, type CategoryFilterValue } from "@/lib/expenseFilters";
import { errorMessage } from "@/lib/db";
import { formatMoney, formatRange, parseDateOnly, plural, toDateOnly } from "@/lib/format";
import {
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  drawBody,
  tableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";
import { cn } from "@/lib/utils";

interface PersonCost {
  id: string;
  name: string;
  totalCost: number;
  expenseCount: number;
}

const lastTableY = (doc: jsPDF, fallback: number) =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || fallback;

/** Each person's share of the costs (what they consumed), whoever paid. */
export default function MyCost() {
  const { flatmates, expenses: allExpenses, categories, settlements, space, isLoading, error, refetch } = useSpaceData();
  const { meId } = useMe(flatmates);
  const { datePreset, dateRange, setDatePreset, setDateRange, applySettlementRange, resetDateFilters } =
    useMyCostFilters();
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilterValue>(EMPTY_CATEGORY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [draft, setDraft] = useState<PickerRange | undefined>();

  // A stored "past settlement" preset whose settlement was deleted falls back to all time.
  useEffect(() => {
    if (!datePreset.startsWith("settlement:") || isLoading) return;
    const id = datePreset.replace("settlement:", "");
    if (!settlements.some((s) => s.id === id)) setDatePreset("all-time");
  }, [settlements, datePreset, setDatePreset, isLoading]);

  const expenses = useMemo(() => {
    let list = allExpenses;
    if (datePreset !== "all-time") {
      const fromStr = toDateOnly(dateRange.from);
      const toStr = toDateOnly(dateRange.to);
      list = list.filter((e) => e.date >= fromStr && e.date <= toStr);
    }
    return applyExpenseFilters(list, EMPTY_PEOPLE_FILTERS, categoryFilters);
  }, [allExpenses, datePreset, dateRange, categoryFilters]);

  // Unchanged rule: each split member's cost is amount ÷ people in the split.
  const personCosts = useMemo<PersonCost[]>(() => {
    const costMap = new Map<string, PersonCost>();
    flatmates.forEach((f) => costMap.set(f.id, { id: f.id, name: f.name, totalCost: 0, expenseCount: 0 }));
    expenses.forEach((expense) => {
      const splitAmount = expense.amount / expense.expense_splits.length;
      expense.expense_splits.forEach((split) => {
        const personCost = costMap.get(split.flatmate_id);
        if (personCost) {
          personCost.totalCost += splitAmount;
          personCost.expenseCount += 1;
        }
      });
    });
    return Array.from(costMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [flatmates, expenses]);

  const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);
  const average = personCosts.length > 0 ? totalCost / personCosts.length : 0;
  const maxCost = Math.max(...personCosts.map((p) => p.totalCost), 1);
  const activeSettlement = datePreset.startsWith("settlement:")
    ? settlements.find((s) => `settlement:${s.id}` === datePreset)
    : undefined;

  const periodLabel = datePreset === "all-time" ? "All time" : formatRange(dateRange.from, dateRange.to);

  const generatePDF = () => {
    try {
      const doc = createPdfDoc();
      let y = drawPdfHeader(doc, {
        title: "Cost Report",
        subtitle: space ? space.name : undefined,
        meta: `${datePreset === "all-time" ? "All time" : `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`} · ${format(new Date(), "MMM d, yyyy")}`,
      });
      y = drawBody(doc, `Total cost: ${pdfAmount(totalCost)}`, y, { muted: true });
      y += 4;
      y = drawSectionTitle(doc, "Cost per Person", y);

      autoTable(doc, {
        ...tableStyles({
          startY: y + 2,
          head: [["Name", "Total Cost", "Expenses"]],
          body: personCosts.map((p) => [p.name, pdfAmount(p.totalCost), `${p.expenseCount}`]),
          columnStyles: {
            1: { halign: "right", fontStyle: "bold" },
            2: { halign: "center", cellWidth: 30 },
          },
          showHead: "everyPage",
          rowPageBreak: "avoid",
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY = lastTableY(doc, y);
      const pageHeight = doc.internal.pageSize.height;
      let summaryStartY = finalY + 12;
      if (summaryStartY > pageHeight - 50) {
        doc.addPage();
        summaryStartY = 20;
      }

      let cy = drawSectionTitle(doc, "Summary", summaryStartY);
      cy = drawBody(doc, `Total people: ${personCosts.length}`, cy + 4);
      cy = drawBody(doc, `Total cost: ${pdfAmount(totalCost)}`, cy);
      cy = drawBody(
        doc,
        `Average per person: ${personCosts.length > 0 ? pdfAmount(totalCost / personCosts.length) : "Rs. 0.00"}`,
        cy
      );
      drawBody(doc, `Total expenses: ${expenses.length}`, cy);

      drawPdfFooter(doc);
      doc.save(`cost_report_${space?.name || "all"}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF");
    }
  };

  const filterCount = categoryFilters.include.length + categoryFilters.exclude.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Insights"
        documentTitle="Cost per person"
        description="Each person's share of the costs, whoever paid at the till."
        actions={
          !isLoading &&
          personCosts.length > 0 && (
            <Button variant="outline" onClick={generatePDF}>
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
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={RotateCw}
          title="Couldn't load costs"
          action={<Button onClick={refetch}>Try again</Button>}
          className="rounded-2xl border bg-card"
        >
          {errorMessage(error)}
        </EmptyState>
      ) : flatmates.length === 0 ? (
        <EmptyState icon={Users} title="No people in this space yet" className="rounded-2xl border bg-card">
          Costs per person appear once people share expenses.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Popover
              open={periodOpen}
              onOpenChange={(open) => {
                setPeriodOpen(open);
                if (!open) setDraft(undefined);
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 max-w-full gap-2 px-3 font-normal">
                  <CalendarDays className="text-muted-foreground" />
                  <span className="truncate font-medium">{periodLabel}</span>
                  {activeSettlement?.note && (
                    <span className="hidden truncate text-muted-foreground sm:inline">· {activeSettlement.note}</span>
                  )}
                  <ChevronDown className="ml-1 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="flex max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0 sm:flex-row"
              >
                <div className="min-w-48 border-b p-2 sm:border-b-0 sm:border-r">
                  <PresetRow
                    label="All time"
                    active={datePreset === "all-time"}
                    onClick={() => {
                      resetDateFilters();
                      setPeriodOpen(false);
                    }}
                  />
                  {settlements.length > 0 && (
                    <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Settled periods</p>
                  )}
                  {[...settlements]
                    .sort((a, b) => (a.to_date < b.to_date ? 1 : -1))
                    .map((s) => (
                      <PresetRow
                        key={s.id}
                        label={formatRange(parseDateOnly(s.from_date), parseDateOnly(s.to_date))}
                        hint={s.note}
                        active={datePreset === `settlement:${s.id}`}
                        onClick={() => {
                          applySettlementRange(s.id, parseDateOnly(s.from_date), parseDateOnly(s.to_date));
                          setPeriodOpen(false);
                        }}
                      />
                    ))}
                </div>
                <div className="p-1">
                  <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                    {draft?.from && !draft.to ? "Now pick the end date" : "Or pick a start and end date"}
                  </p>
                  <Calendar
                    mode="range"
                    selected={draft ?? (datePreset === "all-time" ? undefined : { from: dateRange.from, to: dateRange.to })}
                    defaultMonth={draft?.from ?? dateRange.to}
                    onSelect={(next, day) => {
                      if (!draft || (draft.from && draft.to)) {
                        setDraft({ from: day, to: undefined });
                        return;
                      }
                      if (next?.from && next.to) {
                        setDateRange({ from: next.from, to: next.to });
                        setDraft(undefined);
                        setPeriodOpen(false);
                      } else {
                        setDraft({ from: day, to: undefined });
                      }
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant={filtersOpen ? "secondary" : "outline"}
              className="h-10 gap-2 px-3"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="text-muted-foreground" />
              Categories
              {filterCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </Button>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => setCategoryFilters(EMPTY_CATEGORY_FILTERS)}
                className="px-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                Clear categories
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="rounded-2xl border bg-card p-4 sm:p-5">
              <CategoryFilterSection
                categories={categories}
                categoryFilters={categoryFilters}
                setCategoryFilters={setCategoryFilters}
              />
            </div>
          )}

          <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-semibold">Cost per person</h2>
              <span className="text-sm text-muted-foreground">
                {formatMoney(totalCost)} total · {formatMoney(average)} average
              </span>
            </div>
            {expenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses in this period.</p>
            ) : (
              <ul className="mt-1 divide-y">
                {personCosts.map((p) => {
                  const isMe = p.id === meId;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <PersonAvatar name={p.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={cn("truncate text-sm", isMe ? "font-semibold" : "font-medium")}>
                            {isMe ? `You (${p.name})` : p.name}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(p.totalCost)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-secondary">
                          <div
                            className={cn("h-1.5 rounded-full", isMe ? "bg-primary" : "bg-foreground/30")}
                            style={{ width: `${Math.max((p.totalCost / maxCost) * 100, p.totalCost > 0 ? 1.5 : 0)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Share of {plural(p.expenseCount, "expense")}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const PresetRow = ({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string | null;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full flex-col rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
      active && "bg-primary/10 text-primary hover:bg-primary/10"
    )}
  >
    <span className="font-medium">{label}</span>
    {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
  </button>
);
