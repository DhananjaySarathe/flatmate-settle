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
import { CalendarIcon, Loader2, Download, TrendingUp, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { Checkbox } from "@/components/ui/checkbox";
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
          .gte("date", dateRange.from.toISOString().split("T")[0])
          .lte("date", dateRange.to.toISOString().split("T")[0])
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
      const doc = new jsPDF();

      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 30, "F");
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("ANALYTICS SUMMARY", 14, 20);

      if (selectedSplitSpace) {
        doc.setFontSize(12);
        doc.text(`SplitSpace: ${selectedSplitSpace.name}`, 14, 26);
      }

      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
          dateRange.to,
          "MMM dd, yyyy"
        )}`,
        14,
        40
      );
      doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 45);

      // Category Breakdown
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("Category Breakdown", 14, 60);

      const categoryData = categoryTotals
        .filter((cat) => cat.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((cat) => [
          cat.name,
          `$${cat.total.toFixed(2)}`,
          `${cat.percentage.toFixed(1)}%`,
          cat.count.toString(),
        ]);

      autoTable(doc, {
        startY: 65,
        head: [["Category", "Total", "%", "Count"]],
        body: categoryData,
        theme: "grid",
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "center" },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 65;

      // Key Insights
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text("Key Insights", 14, finalY + 20);

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 14, finalY + 30);
      doc.text(
        `Most Expensive Category: ${mostExpensiveCategory.name} ($${mostExpensiveCategory.total.toFixed(2)})`,
        14,
        finalY + 35
      );
      doc.text(`Average per Day: $${avgPerDay.toFixed(2)}`, 14, finalY + 40);
      doc.text(`Average per Person: $${avgPerPerson.toFixed(2)}`, 14, finalY + 45);
      doc.text(`Fairness Score: ${fairnessScore.toFixed(1)}/100`, 14, finalY + 50);

      // Top Days
      if (topDays.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("Top 5 Most Expensive Days", 14, finalY + 65);

        const topDaysData = topDays.map((day, idx) => [
          `${idx + 1}`,
          format(new Date(day.date), "MMM dd, yyyy"),
          `$${day.total.toFixed(2)}`,
          day.count.toString(),
        ]);

        autoTable(doc, {
          startY: finalY + 70,
          head: [["#", "Date", "Total", "Expenses"]],
          body: topDaysData,
          theme: "grid",
          headStyles: {
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          columnStyles: {
            2: { halign: "right" },
            3: { halign: "center" },
          },
        });
      }

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
          {selectedSplitSpace && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              SplitSpace: {selectedSplitSpace.name}
            </p>
          )}
        </div>
        <Button
          onClick={generateAnalyticsSummaryPDF}
          disabled={pdfLoading !== null}
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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      Advanced Filters
                    </DialogTitle>
                    <DialogDescription>
                      Filter expenses by people and categories to get precise
                      reports
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 md:grid-cols-2 mt-4">
                    <PeopleFilters
                      flatmates={flatmates}
                      onFiltersChange={setPeopleFilters}
                    />

                    {/* Category Filters */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Category Filters
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Include Categories (Show only these)
                          </Label>
                          <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-secondary/30 rounded-lg border border-border/50">
                            {categories.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No categories available
                              </p>
                            ) : (
                              categories.map((category) => (
                                <div
                                  key={category.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`analytics-include-${category.id}`}
                                    checked={categoryFilters.include.includes(
                                      category.id
                                    )}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setCategoryFilters({
                                          ...categoryFilters,
                                          include: [
                                            ...categoryFilters.include,
                                            category.id,
                                          ],
                                        });
                                      } else {
                                        setCategoryFilters({
                                          ...categoryFilters,
                                          include:
                                            categoryFilters.include.filter(
                                              (id) => id !== category.id
                                            ),
                                        });
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`analytics-include-${category.id}`}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    {category.name}
                                  </Label>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Exclude Categories (Hide these)
                          </Label>
                          <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-secondary/30 rounded-lg border border-border/50">
                            {categories.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No categories available
                              </p>
                            ) : (
                              categories.map((category) => (
                                <div
                                  key={category.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`analytics-exclude-${category.id}`}
                                    checked={categoryFilters.exclude.includes(
                                      category.id
                                    )}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setCategoryFilters({
                                          ...categoryFilters,
                                          exclude: [
                                            ...categoryFilters.exclude,
                                            category.id,
                                          ],
                                        });
                                      } else {
                                        setCategoryFilters({
                                          ...categoryFilters,
                                          exclude:
                                            categoryFilters.exclude.filter(
                                              (id) => id !== category.id
                                            ),
                                        });
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`analytics-exclude-${category.id}`}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    {category.name}
                                  </Label>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetFilters();
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reset All Filters
                    </Button>
                    <Button onClick={() => setFiltersModalOpen(false)}>
                      Apply Filters
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgPerDay.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Over {daysDiff} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg per Person</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgPerPerson.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{flatmates.length} people</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fairnessScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryTotals
              .filter((cat) => cat.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-bold">${cat.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{cat.percentage.toFixed(1)}% of total</span>
                    <span>{cat.count} expense{cat.count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Expense Trend Graph */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Expense Trends</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="period" className="text-sm">Period:</Label>
              <Select value={graphPeriod} onValueChange={(value: "day" | "week" | "month") => setGraphPeriod(value)}>
                <SelectTrigger id="period" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
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

      {/* Top Days */}
      {topDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Most Expensive Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDays.map((day, idx) => (
                <div key={day.date} className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">#{idx + 1}</span>
                    <span>{format(new Date(day.date), "MMM dd, yyyy")}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${day.total.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{day.count} expense{day.count !== 1 ? "s" : ""}</div>
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

