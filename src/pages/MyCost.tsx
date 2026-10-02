import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Loader2,
  Download,
  Filter,
  X,
  DollarSign,
  CalendarIcon,
  Bookmark,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMyCostFilters } from "@/hooks/useMyCostFilters";
import autoTable from "jspdf-autotable";
import {
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  drawBody,
  tableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { PeriodPicker } from "@/components/PeriodPicker";
import { PersonAvatar } from "@/components/PersonAvatar";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import { formatMoney, formatRange, monthRanges, parseDay, sameRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Flatmate {
  id: string;
  name: string;
  email: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string;
  categories?: {
    name: string;
  };
  expense_splits: { flatmate_id: string }[];
}

interface PersonCost {
  id: string;
  name: string;
  totalCost: number;
  expenseCount: number;
}

interface SavedSettlement {
  id: string;
  from_date: string;
  to_date: string;
  note: string | null;
  created_at: string;
}

export default function MyCost() {
  const {
    selectedSplitSpace,
    splitSpaces,
    loading: contextLoading,
  } = useSplitSpace();
  const [loading, setLoading] = useState(true);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [personCosts, setPersonCosts] = useState<PersonCost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<{
    include: string[];
    exclude: string[];
  }>({
    include: [],
    exclude: [],
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savedSettlements, setSavedSettlements] = useState<SavedSettlement[]>(
    []
  );
  const {
    datePreset,
    dateRange,
    setDatePreset,
    setDateRange,
    applySettlementRange,
    resetDateFilters,
  } = useMyCostFilters();

  const fetchDataWithoutSplitSpace = async () => {
    setLoading(true);
    try {
      const { data: flatmatesData, error: flatmatesError } = await supabase
        .from("flatmates")
        .select("id, name, email")
        .order("name");

      if (flatmatesError) throw flatmatesError;

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          categories (name),
          expense_splits (
            flatmate_id
          )
        `
        )
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;

      setFlatmates(flatmatesData || []);
      setAllExpenses(expensesData || []);

      // Fetch categories
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, name")
          .eq("created_by", user.id)
          .order("name");
        setCategories(categoriesData || []);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(`Failed to fetch data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedSplitSpace) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const flatmatesQuery = supabase
        .from("flatmates")
        .select("id, name, email")
        .order("name");

      const { data: flatmatesData, error: flatmatesError } =
        await flatmatesQuery.or(
          `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`
        );

      if (flatmatesError) {
        if (
          flatmatesError.message?.includes("column") ||
          flatmatesError.code === "42703"
        ) {
          const { data, error } = await supabase
            .from("flatmates")
            .select("id, name, email")
            .order("name");
          if (error) throw error;
          setFlatmates(data || []);
        } else {
          throw flatmatesError;
        }
      } else {
        setFlatmates(flatmatesData || []);
      }

      const expensesQuery = supabase
        .from("expenses")
        .select(
          `
          *,
          categories (name),
          expense_splits (
            flatmate_id
          )
        `
        )
        .order("date", { ascending: false });

      const { data: expensesData, error: expensesError } =
        await expensesQuery.or(
          `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`
        );

      if (expensesError) {
        if (
          expensesError.message?.includes("column") ||
          expensesError.code === "42703"
        ) {
          const { data, error } = await supabase
            .from("expenses")
            .select(
              `
              *,
              categories (name),
              expense_splits (
                flatmate_id
              )
            `
            )
            .order("date", { ascending: false });
          if (error) throw error;
          setAllExpenses(data || []);
        } else {
          throw expensesError;
        }
      } else {
        setAllExpenses(expensesData || []);
      }

      // Fetch categories
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, name")
          .eq("created_by", user.id)
          .order("name");
        setCategories(categoriesData || []);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(`Failed to fetch data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contextLoading) {
      return;
    }

    if (splitSpaces.length === 0) {
      fetchDataWithoutSplitSpace();
    } else if (selectedSplitSpace) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedSplitSpace, splitSpaces.length, contextLoading]);

  useEffect(() => {
    if (!selectedSplitSpace) {
      setSavedSettlements([]);
      return;
    }
    const loadSavedSettlements = async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("id, from_date, to_date, note, created_at")
        .eq("split_space_id", selectedSplitSpace.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") return;
        console.error("Failed to load saved settlements:", error);
        return;
      }
      setSavedSettlements(data || []);
    };
    loadSavedSettlements();
  }, [selectedSplitSpace]);

  useEffect(() => {
    if (!datePreset.startsWith("settlement:")) return;
    const settlementId = datePreset.replace("settlement:", "");
    if (!savedSettlements.some((s) => s.id === settlementId)) {
      setDatePreset("all-time");
    }
  }, [savedSettlements, datePreset, setDatePreset]);

  // Apply date and category filters to expenses
  useEffect(() => {
    let filteredExpenses = [...allExpenses];

    if (datePreset !== "all-time") {
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.date >= fromStr && expense.date <= toStr
      );
    }

    // Apply category filters
    if (categoryFilters.include.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        return (
          expense.category_id &&
          categoryFilters.include.includes(expense.category_id)
        );
      });
    }

    if (categoryFilters.exclude.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        return (
          !expense.category_id ||
          !categoryFilters.exclude.includes(expense.category_id)
        );
      });
    }

    setExpenses(filteredExpenses);
  }, [allExpenses, categoryFilters, datePreset, dateRange]);

  // Calculate costs per person
  useEffect(() => {
    if (flatmates.length > 0 && expenses.length > 0) {
      calculateCosts();
    } else if (flatmates.length > 0) {
      // No expenses, set all costs to 0
      setPersonCosts(
        flatmates.map((f) => ({
          id: f.id,
          name: f.name,
          totalCost: 0,
          expenseCount: 0,
        }))
      );
    }
  }, [flatmates, expenses]);

  const calculateCosts = () => {
    const costMap = new Map<string, PersonCost>();

    // Initialize costs
    flatmates.forEach((flatmate) => {
      costMap.set(flatmate.id, {
        id: flatmate.id,
        name: flatmate.name,
        totalCost: 0,
        expenseCount: 0,
      });
    });

    // Calculate total cost per person
    expenses.forEach((expense) => {
      // Calculate split amount per person
      const splitAmount = expense.amount / expense.expense_splits.length;

      expense.expense_splits.forEach((split) => {
        const personCost = costMap.get(split.flatmate_id);
        if (personCost) {
          personCost.totalCost += splitAmount;
          personCost.expenseCount += 1;
        }
      });
    });

    const calculatedCosts = Array.from(costMap.values());
    // Sort by total cost descending
    calculatedCosts.sort((a, b) => b.totalCost - a.totalCost);
    setPersonCosts(calculatedCosts);
  };

  const resetFilters = () => {
    setCategoryFilters({
      include: [],
      exclude: [],
    });
  };

  const getPeriodLabel = () => {
    if (datePreset === "all-time") {
      return "All time";
    }
    return `${format(dateRange.from, "MMM d, yyyy")} – ${format(
      dateRange.to,
      "MMM d, yyyy"
    )}`;
  };

  const handleDatePresetChange = (value: string) => {
    if (value === "all-time" || value === "custom") {
      setDatePreset(value);
      return;
    }
    if (value.startsWith("settlement:")) {
      const settlementId = value.replace("settlement:", "");
      const settlement = savedSettlements.find((s) => s.id === settlementId);
      if (settlement) {
        applySettlementRange(
          settlement.id,
          parseDay(settlement.from_date),
          parseDay(settlement.to_date)
        );
      }
    }
  };

  const generatePDF = async () => {
    setPdfLoading(true);
    try {
      const doc = createPdfDoc();
      const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);

      let y = drawPdfHeader(doc, {
        title: "Cost Report",
        subtitle: selectedSplitSpace ? selectedSplitSpace.name : undefined,
        meta: `${getPeriodLabel()} · ${format(new Date(), "MMM d, yyyy")}`,
      });
      y = drawBody(doc, `Total cost: ${pdfAmount(totalCost)}`, y, { muted: true });
      y += 4;

      y = drawSectionTitle(doc, "Cost per Person", y);

      const costData = personCosts.map((personCost) => [
        personCost.name,
        pdfAmount(personCost.totalCost),
        `${personCost.expenseCount}`,
      ]);

      autoTable(doc, {
        ...tableStyles({
          startY: y + 2,
          head: [["Name", "Total Cost", "Expenses"]],
          body: costData,
          columnStyles: {
            1: { halign: "right", fontStyle: "bold" },
            2: { halign: "center", cellWidth: 30 },
          },
          showHead: "everyPage",
          rowPageBreak: "avoid",
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY = (doc as any).lastAutoTable?.finalY || y;
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
        `Average per person: ${
          personCosts.length > 0 ? pdfAmount(totalCost / personCosts.length) : "Rs. 0.00"
        }`,
        cy
      );
      cy = drawBody(doc, `Total expenses: ${expenses.length}`, cy);

      drawPdfFooter(doc);

      doc.save(
        `cost_report_${selectedSplitSpace?.name || "all"}_${format(
          new Date(),
          "yyyy-MM-dd"
        )}.pdf`
      );
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const { thisMonth, lastMonth } = monthRanges();
  const isCustom = datePreset === "custom";
  const onThisMonth = isCustom && sameRange(dateRange, thisMonth);
  const onLastMonth = isCustom && sameRange(dateRange, lastMonth);
  const settlementValue = datePreset.startsWith("settlement:") ? datePreset : undefined;
  const activeCategoryFilters = categoryFilters.include.length + categoryFilters.exclude.length;

  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div>
        <PageHeader title="Cost per person" />
        <Panel>
          <p className="py-2 text-sm text-muted-foreground">Pick a space from the switcher to see costs.</p>
        </Panel>
      </div>
    );
  }

  const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);
  const maxCost = Math.max(0.01, ...personCosts.map((p) => p.totalCost));

  return (
    <div className="space-y-5">
      <PageHeader
        className="mb-1 lg:mb-2"
        title="Cost per person"
        description={`What each person's share of the spending came to · ${getPeriodLabel()}`}
        actions={
          <Button
            onClick={generatePDF}
            disabled={pdfLoading || loading || personCosts.length === 0}
            variant="outline"
            className="bg-card"
          >
            {pdfLoading ? <Loader2 className="animate-spin" /> : <Download />}
            Download PDF
          </Button>
        }
      />

      <PeriodPicker
        chips={[
          {
            key: "all-time",
            label: "All time",
            active: datePreset === "all-time",
            onSelect: () => setDatePreset("all-time"),
          },
          { key: "this-month", label: "This month", active: onThisMonth, onSelect: () => setDateRange(thisMonth) },
          { key: "last-month", label: "Last month", active: onLastMonth, onSelect: () => setDateRange(lastMonth) },
        ]}
        range={dateRange}
        onCustomRange={setDateRange}
        customActive={isCustom && !onThisMonth && !onLastMonth}
        trailing={
          <>
            {savedSettlements.length > 0 && (
              <Select value={settlementValue} onValueChange={handleDatePresetChange}>
                <SelectTrigger
                  className={cn(
                    "h-9 w-auto gap-1.5 rounded-full px-3.5",
                    settlementValue ? "border-foreground bg-foreground text-background" : "bg-card"
                  )}
                  aria-label="Load a past settle-up period"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Past settle-ups" />
                </SelectTrigger>
                <SelectContent align="end">
                  {savedSettlements.map((settlement) => (
                    <SelectItem key={settlement.id} value={`settlement:${settlement.id}`}>
                      {formatRange(parseDay(settlement.from_date), parseDay(settlement.to_date))}
                      {settlement.note ? ` · ${settlement.note}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {categories.length > 0 && (
              <Dialog open={filtersModalOpen} onOpenChange={setFiltersModalOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      activeCategoryFilters > 0
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
                    )}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Categories
                    {activeCategoryFilters > 0 && (
                      <span className="money rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {activeCategoryFilters}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Filter by category</DialogTitle>
                    <DialogDescription>
                      Work out each person's share for just some kinds of spending.
                    </DialogDescription>
                  </DialogHeader>
                  <CategoryFilterSection
                    categories={categories}
                    categoryFilters={categoryFilters}
                    setCategoryFilters={setCategoryFilters}
                  />
                  <div className="mt-2 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={resetFilters} disabled={activeCategoryFilters === 0}>
                      <X />
                      Clear
                    </Button>
                    <Button onClick={() => setFiltersModalOpen(false)}>Done</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      {loading ? (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      ) : personCosts.length === 0 || expenses.length === 0 ? (
        <Panel>
          <div className="py-2">
            <p className="font-medium">No expenses in this period</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCategoryFilters > 0
                ? "Nothing matches the selected categories. Try clearing the filter."
                : "Pick a different period, or add expenses to see each person's share."}
            </p>
          </div>
        </Panel>
      ) : (
        <Panel
          title="Each person's share"
          description={`${formatMoney(totalCost)} across ${expenses.length} expense${
            expenses.length === 1 ? "" : "s"
          } · average ${formatMoney(personCosts.length > 0 ? totalCost / personCosts.length : 0)} per person`}
          bodyClassName="pt-1"
        >
          <ul className="divide-y divide-border/70">
            {personCosts.map((personCost) => (
              <li key={personCost.id} className="flex items-center gap-3 py-3">
                <PersonAvatar name={personCost.name} seed={personCost.id} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{personCost.name}</p>
                    <p className="money shrink-0 font-semibold">{formatMoney(personCost.totalCost)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${(personCost.totalCost / maxCost) * 100}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      in {personCost.expenseCount} expense{personCost.expenseCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
