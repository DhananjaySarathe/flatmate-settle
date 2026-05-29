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
          new Date(settlement.from_date),
          new Date(settlement.to_date)
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

  const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Cost</h1>
          {selectedSplitSpace && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              <span className="hidden sm:inline">SplitSpace: </span>
              {selectedSplitSpace.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {categories.length > 0 && (
            <Dialog
              open={filtersModalOpen}
              onOpenChange={setFiltersModalOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                  {(categoryFilters.include.length > 0 ||
                    categoryFilters.exclude.length > 0) && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                    >
                      {categoryFilters.include.length +
                        categoryFilters.exclude.length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Category Filters
                  </DialogTitle>
                  <DialogDescription>
                    Filter expenses by categories to calculate costs
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Include Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Label className="text-sm font-medium">
                        Show only expenses in these categories
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
                                id={`include-${category.id}`}
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
                                      include: categoryFilters.include.filter(
                                        (id) => id !== category.id
                                      ),
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`include-${category.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {category.name}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Separator />

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Exclude Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Label className="text-sm font-medium">
                        Hide expenses in these categories
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
                                id={`exclude-${category.id}`}
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
                                      exclude: categoryFilters.exclude.filter(
                                        (id) => id !== category.id
                                      ),
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`exclude-${category.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {category.name}
                              </Label>
                            </div>
                          ))
                        )}
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
                    Reset Filters
                  </Button>
                  <Button onClick={() => setFiltersModalOpen(false)}>
                    Apply Filters
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            onClick={generatePDF}
            disabled={pdfLoading || personCosts.length === 0}
            className="gap-2"
          >
            {pdfLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Period</Label>
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
                {savedSettlements.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5" />
                        Past settlements
                      </SelectLabel>
                      {savedSettlements.map((settlement) => (
                        <SelectItem
                          key={settlement.id}
                          value={`settlement:${settlement.id}`}
                        >
                          {format(new Date(settlement.from_date), "MMM d")} –{" "}
                          {format(new Date(settlement.to_date), "MMM d, yyyy")}
                          {settlement.note ? ` · ${settlement.note}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {datePreset === "all-time" ? (
            <p className="text-sm text-muted-foreground">
              Showing costs across all expenses in this split space.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[240px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {format(dateRange.from, "PPP")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      date && setDateRange({ ...dateRange, from: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground text-center sm:text-left hidden sm:inline">
                to
              </span>
              <span className="text-muted-foreground text-center sm:hidden">
                ↓
              </span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[240px] justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {format(dateRange.to, "PPP")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      date && setDateRange({ ...dateRange, to: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={resetDateFilters}
              >
                Reset to all time
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cost Per Person
          </CardTitle>
          <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
        </CardHeader>
        <CardContent>
          {personCosts.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No expenses found. Add expenses to see costs.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full border-collapse min-w-[600px] sm:min-w-0">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-xs sm:text-sm">Name</th>
                      <th className="text-right p-2 text-xs sm:text-sm">
                        Total Cost
                      </th>
                      <th className="text-center p-2 text-xs sm:text-sm">
                        Expenses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {personCosts.map((personCost) => (
                      <tr key={personCost.id} className="border-b">
                        <td className="p-2 font-medium text-sm sm:text-base">
                          {personCost.name}
                        </td>
                        <td className="p-2 text-right font-semibold text-sm sm:text-base text-primary">
                          ₹{personCost.totalCost.toFixed(2)}
                        </td>
                        <td className="p-2 text-center text-sm sm:text-base">
                          {personCost.expenseCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-secondary/30 rounded-lg border border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="font-bold text-lg">
                    Total Cost: ₹{totalCost.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Average per person: ₹
                    {personCosts.length > 0
                      ? (totalCost / personCosts.length).toFixed(2)
                      : "0.00"}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

