import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Filter, X, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

  // Apply category filters to expenses
  useEffect(() => {
    let filteredExpenses = [...allExpenses];

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
  }, [allExpenses, categoryFilters]);

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

  const generatePDF = async () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF();

      // Header
      doc.setFillColor(59, 130, 246); // Blue header
      doc.rect(0, 0, 210, 30, "F");

      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("EXPENSEWAALE COST REPORT", 14, 20);

      if (selectedSplitSpace) {
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "normal");
        doc.text(`SplitSpace: ${selectedSplitSpace.name}`, 14, 26);
      }

      // Reset font
      doc.setFont(undefined, "normal");

      // Report info section
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        14,
        40
      );

      const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);
      doc.text(`Total Cost: ₹${totalCost.toFixed(2)}`, 14, 45);

      // Cost Summary Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("COST PER PERSON", 14, 60);

      // Person-wise cost table
      const costData = personCosts.map((personCost) => [
        personCost.name,
        `₹${personCost.totalCost.toFixed(2)}`,
        `${personCost.expenseCount}`,
      ]);

      autoTable(doc, {
        startY: 67,
        head: [["Name", "Total Cost", "Expenses"]],
        body: costData,
        theme: "grid",
        headStyles: {
          fillColor: [79, 70, 229], // Purple header
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
          cellPadding: 5,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5,
          overflow: "linebreak",
          cellWidth: "wrap",
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: "right", fontStyle: "bold", cellWidth: 60 },
          2: { halign: "center", cellWidth: 30 },
        },
        margin: { left: 14, right: 14, top: 67 },
        pageBreak: "auto",
        rowPageBreak: "avoid",
        showHead: "everyPage",
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 67;

      // Check if we need a new page for summary
      let summaryStartY = finalY + 15;
      const pageHeight = doc.internal.pageSize.height;
      
      if (summaryStartY > pageHeight - 50) {
        doc.addPage();
        summaryStartY = 20;
      }

      // Summary section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("SUMMARY", 14, summaryStartY);

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "normal");
      doc.text(
        `Total People: ${personCosts.length}`,
        14,
        summaryStartY + 10
      );
      doc.text(
        `Total Cost: ₹${totalCost.toFixed(2)}`,
        14,
        summaryStartY + 16
      );
      doc.text(
        `Average Cost per Person: ₹${
          personCosts.length > 0
            ? (totalCost / personCosts.length).toFixed(2)
            : "0.00"
        }`,
        14,
        summaryStartY + 22
      );
      doc.text(
        `Total Expenses: ${expenses.length}`,
        14,
        summaryStartY + 28
      );

      // Footer - position dynamically based on content
      const footerY = Math.min(pageHeight - 10, summaryStartY + 40);
      
      // Only add footer if there's space (at least 5mm from bottom)
      if (footerY < pageHeight - 5) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, "normal");
        const totalPages = doc.getNumberOfPages();
        doc.text(
          "Generated by ExpenseWaale - Expense Management System",
          14,
          footerY
        );
        doc.text(
          `Page ${totalPages} of ${totalPages} • ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
          180,
          footerY
        );
      } else {
        // If no space on current page, add footer on new page
        doc.addPage();
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, "normal");
        const totalPages = doc.getNumberOfPages();
        doc.text(
          "Generated by ExpenseWaale - Expense Management System",
          14,
          pageHeight - 10
        );
        doc.text(
          `Page ${totalPages} of ${totalPages} • ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
          180,
          pageHeight - 10
        );
      }

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

      {/* Cost Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cost Per Person
          </CardTitle>
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

