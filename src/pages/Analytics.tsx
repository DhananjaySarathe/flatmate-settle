import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  Loader2,
  Download,
  TrendingUp,
  Filter,
  X,
  Wallet,
  CalendarDays,
  Users as UsersIcon,
  Scale,
  Flame,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import autoTable from "jspdf-autotable";
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
import { ExpenseTrendGraph } from "@/components/graphs/ExpenseTrendGraph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PeopleFilters } from "@/components/PeopleFilters";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import { Badge } from "@/components/ui/badge";
import { useReportFilters } from "@/hooks/useReportFilters";

interface Flatmate {
  id: string;
  name: string;
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

export default function Analytics() {
  const {
    selectedSplitSpace,
    splitSpaces,
    loading: contextLoading,
  } = useSplitSpace();
  const [loading, setLoading] = useState(true);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const {
    dateRange,
    peopleFilters,
    categoryFilters,
    setDateRange,
    setPeopleFilters,
    setCategoryFilters,
    resetFilters,
  } = useReportFilters();
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [graphPeriod, setGraphPeriod] = useState<"day" | "week" | "month">("day");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (contextLoading) return;
    if (splitSpaces.length === 0 || !selectedSplitSpace) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [dateRange, selectedSplitSpace, splitSpaces.length, contextLoading]);

  // Apply filters to expenses
  useEffect(() => {
    let filteredExpenses = [...allExpenses];

    // Apply people filters
    if (peopleFilters.exactMatch.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return peopleFilters.exactMatch.every((id) =>
          expenseFlatmateIds.includes(id)
        );
      });
    }

    if (peopleFilters.anyMatch.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return peopleFilters.anyMatch.some((id) =>
          expenseFlatmateIds.includes(id)
        );
      });
    }

    if (peopleFilters.exclude.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return !peopleFilters.exclude.some(
          (id) => expenseFlatmateIds.includes(id) || expense.paid_by === id
        );
      });
    }

    if (peopleFilters.paidBy.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) =>
        peopleFilters.paidBy.includes(expense.paid_by)
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
  }, [allExpenses, peopleFilters, categoryFilters]);

  const fetchData = async () => {
    if (!selectedSplitSpace) return;

    setLoading(true);
    try {
      const [flatmatesRes, expensesRes, categoriesRes] = await Promise.all([
        supabase
          .from("flatmates")
          .select("id, name")
          .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
          .order("name"),
        supabase
          .from("expenses")
          .select(
            `
            *,
            categories (name),
            expense_splits (flatmate_id)
          `
          )
          .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
          .gte("date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("date", format(dateRange.to, "yyyy-MM-dd"))
          .order("date", { ascending: false }),
        supabase
          .from("categories")
          .select("id, name")
          .eq("created_by", (await supabase.auth.getUser()).data.user?.id || "")
          .order("name"),
      ]);

      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setAllExpenses(expensesRes.data || []);
      // Don't set expenses here - let the filter useEffect handle it
      setCategories(categoriesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(`Failed to fetch data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to expenses - this runs whenever filters or allExpenses change
  useEffect(() => {
    if (allExpenses.length === 0) {
      setExpenses([]);
      return;
    }
    
    let filteredExpenses = [...allExpenses];

    // Apply people filters
    if (peopleFilters.exactMatch.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return peopleFilters.exactMatch.every((id) =>
          expenseFlatmateIds.includes(id)
        );
      });
    }

    if (peopleFilters.anyMatch.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return peopleFilters.anyMatch.some((id) =>
          expenseFlatmateIds.includes(id)
        );
      });
    }

    if (peopleFilters.exclude.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) => {
        const expenseFlatmateIds = expense.expense_splits.map(
          (s) => s.flatmate_id
        );
        return !peopleFilters.exclude.some(
          (id) => expenseFlatmateIds.includes(id) || expense.paid_by === id
        );
      });
    }

    if (peopleFilters.paidBy.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) =>
        peopleFilters.paidBy.includes(expense.paid_by)
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
  }, [allExpenses, peopleFilters, categoryFilters]);

  // Calculate category totals - uses filtered expenses
  const categoryTotals = categories.map((category) => {
    const categoryExpenses = expenses.filter(
      (exp) => exp.category_id === category.id
    );
    const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const percentage =
      expenses.length > 0
        ? (total / expenses.reduce((sum, exp) => sum + exp.amount, 0)) * 100
        : 0;
    return {
      ...category,
      total,
      percentage,
      count: categoryExpenses.length,
    };
  });

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const mostExpensiveCategory = categoryTotals.reduce(
    (max, cat) => (cat.total > max.total ? cat : max),
    categoryTotals[0] || { name: "N/A", total: 0 }
  );

  // Calculate person-wise totals
  const personTotals = flatmates.map((flatmate) => {
    const paidExpenses = expenses.filter((exp) => exp.paid_by === flatmate.id);
    const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    return {
      ...flatmate,
      totalPaid,
      expenseCount: paidExpenses.length,
    };
  });

  // Top 5 most expensive days
  const dailyTotals = expenses.reduce((acc, exp) => {
    const date = exp.date;
    if (!acc[date]) {
      acc[date] = { date, total: 0, count: 0 };
    }
    acc[date].total += exp.amount;
    acc[date].count += 1;
    return acc;
  }, {} as Record<string, { date: string; total: number; count: number }>);

  const topDays = Object.values(dailyTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Average expense per day
  const daysDiff =
    Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    ) || 1;
  const avgPerDay = totalExpenses / daysDiff;
  const avgPerPerson = flatmates.length > 0 ? totalExpenses / flatmates.length : 0;

  // Fairness score (lower variance = more fair)
  const personAmounts = personTotals.map((p) => p.totalPaid);
  const mean = personAmounts.reduce((sum, amt) => sum + amt, 0) / personAmounts.length || 1;
  const variance =
    personAmounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) /
    personAmounts.length;
  const fairnessScore = Math.max(0, 100 - Math.sqrt(variance) * 10);

  const generateAnalyticsSummaryPDF = async () => {
    setPdfLoading("summary");
    try {
      const doc = createPdfDoc();
      const period = `${format(dateRange.from, "MMM d, yyyy")} – ${format(
        dateRange.to,
        "MMM d, yyyy"
      )}`;

      let y = drawPdfHeader(doc, {
        title: "Analytics Summary",
        subtitle: selectedSplitSpace ? selectedSplitSpace.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });
      y = drawBody(doc, `Period: ${period}`, y, { muted: true });
      y += 4;

      y = drawSectionTitle(doc, "Category Breakdown", y);

      const categoryData = categoryTotals
        .filter((cat) => cat.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((cat) => [
          cat.name,
          pdfAmount(cat.total),
          `${cat.percentage.toFixed(1)}%`,
          cat.count.toString(),
        ]);

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

      const finalY = (doc as any).lastAutoTable?.finalY || y;

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
          format(new Date(day.date), "MMM d, yyyy"),
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

      doc.save(
        `analytics_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(
          dateRange.to,
          "yyyy-MM-dd"
        )}.pdf`
      );
      toast.success("Analytics PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(null);
    }
  };

  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">
            Please select a SplitSpace to continue.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-1">Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Spending patterns, trends, and fairness — at a glance.
          </p>
          {selectedSplitSpace && (
            <p className="text-xs text-muted-foreground mt-1">
              SplitSpace: {selectedSplitSpace.name}
            </p>
          )}
        </div>
        <Button
          onClick={generateAnalyticsSummaryPDF}
          disabled={pdfLoading !== null}
          variant="outline"
          className="self-start sm:self-auto"
        >
          {pdfLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Date Range</CardTitle>
            {flatmates.length > 0 && (
              <Dialog
                open={filtersModalOpen}
                onOpenChange={setFiltersModalOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                    {(peopleFilters.exactMatch.length > 0 ||
                      peopleFilters.anyMatch.length > 0 ||
                      peopleFilters.exclude.length > 0 ||
                      peopleFilters.paidBy.length > 0 ||
                      categoryFilters.include.length > 0 ||
                      categoryFilters.exclude.length > 0) && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                      >
                        {peopleFilters.exactMatch.length +
                          peopleFilters.anyMatch.length +
                          peopleFilters.exclude.length +
                          peopleFilters.paidBy.length +
                          categoryFilters.include.length +
                          categoryFilters.exclude.length}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-primary" />
                      Filters
                    </DialogTitle>
                    <DialogDescription>
                      Narrow down what you're analyzing.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-2">
                    <PeopleFilters
                      flatmates={flatmates}
                      onFiltersChange={setPeopleFilters}
                    />

                    <Separator />

                    <CategoryFilterSection
                      categories={categories}
                      categoryFilters={categoryFilters}
                      setCategoryFilters={setCategoryFilters}
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetFilters();
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reset all
                    </Button>
                    <Button onClick={() => setFiltersModalOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-center sm:text-left hidden sm:inline">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.to, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total Spent"
          value={`₹${totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={`${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
          tint="primary"
        />
        <StatCard
          icon={CalendarDays}
          label="Per Day"
          value={`₹${avgPerDay.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={`Over ${daysDiff} day${daysDiff === 1 ? "" : "s"}`}
          tint="amber"
        />
        <StatCard
          icon={UsersIcon}
          label="Per Person"
          value={`₹${avgPerPerson.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={`${flatmates.length} ${flatmates.length === 1 ? "person" : "people"}`}
          tint="accent"
        />
        <FairnessCard score={fairnessScore} />
      </div>

      {/* Expense Trend Graph */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Expense Trends
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Spending over time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="period" className="text-xs text-muted-foreground">
                View:
              </Label>
              <Select
                value={graphPeriod}
                onValueChange={(value: "day" | "week" | "month") => setGraphPeriod(value)}
              >
                <SelectTrigger id="period" className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ExpenseTrendGraph
            expenses={expenses.map((exp) => ({
              date: exp.date,
              amount: exp.amount,
            }))}
            period={graphPeriod}
          />
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Category Breakdown
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Where the money's going
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryTotals
              .filter((cat) => cat.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((cat, idx) => (
                <CategoryBar
                  key={cat.id}
                  name={cat.name}
                  total={cat.total}
                  percentage={cat.percentage}
                  count={cat.count}
                  rank={idx}
                />
              ))}
            {categoryTotals.filter((c) => c.total > 0).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No category data for the selected range.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Days */}
      {topDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary" />
              Top 5 Most Expensive Days
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              The days that drained the wallet
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDays.map((day, idx) => (
                <div
                  key={day.date}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    idx === 0
                      ? "bg-primary/5 border-primary/30"
                      : "bg-secondary/40 border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                        idx === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm sm:text-base">
                        {format(new Date(day.date), "EEE, MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.count} expense{day.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-base sm:text-lg font-bold">
                      ₹{day.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Sub-components for visual stat cards ----

const TINT_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  amber: "bg-amber-500/10 text-amber-700",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint = "primary",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub: string;
  tint?: "primary" | "accent" | "amber";
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-xl sm:text-2xl font-bold mt-2 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", TINT_CLASSES[tint])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FairnessCard({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 75
      ? { ring: "stroke-accent", label: "Fair", labelClass: "text-accent" }
      : pct >= 50
      ? { ring: "stroke-amber-500", label: "Uneven", labelClass: "text-amber-700" }
      : { ring: "stroke-destructive", label: "Skewed", labelClass: "text-destructive" };

  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={r} className="stroke-secondary" strokeWidth="6" fill="none" />
              <circle
                cx="32"
                cy="32"
                r={r}
                className={cn("transition-all", tone.ring)}
                strokeWidth="6"
                fill="none"
                strokeDasharray={c}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{pct.toFixed(0)}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fairness
            </p>
            <p className={cn("text-base font-bold mt-1", tone.labelClass)}>{tone.label}</p>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CATEGORY_PALETTE = [
  "bg-primary",
  "bg-accent",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-600",
  "bg-violet-500",
  "bg-emerald-600",
  "bg-orange-500",
];

function CategoryBar({
  name,
  total,
  percentage,
  count,
  rank,
}: {
  name: string;
  total: number;
  percentage: number;
  count: number;
  rank: number;
}) {
  const barColor = CATEGORY_PALETTE[rank % CATEGORY_PALETTE.length];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", barColor)} />
          <span className="font-medium text-sm truncate">{name}</span>
        </div>
        <span className="font-semibold text-sm tabular-nums">
          ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden">
        <div
          className={cn("h-2 rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{percentage.toFixed(1)}%</span>
        <span>
          {count} expense{count !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

