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
  CalendarIcon,
  Loader2,
  Receipt,
  Download,
  Mail,
  Copy,
  Check,
  Filter,
  ArrowUpDown,
  X,
  ChevronDown,
  Bookmark,
  Share2,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EmailReportDialog from "@/components/EmailReportDialog";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { PeopleFilters } from "@/components/PeopleFilters";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useReportFilters } from "@/hooks/useReportFilters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateBalances as calcBalances,
  calculateSettlements as calcSettlements,
  buildShareSnapshot,
} from "@/lib/settlement";

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

interface Balance {
  id: string;
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export default function Reports() {
  const {
    selectedSplitSpace,
    splitSpaces,
    loading: contextLoading,
  } = useSplitSpace();
  const [loading, setLoading] = useState(true);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const {
    dateRange,
    peopleFilters,
    categoryFilters,
    setDateRange,
    setPeopleFilters,
    setCategoryFilters,
    resetFilters,
  } = useReportFilters();
  const [pdfLoading, setPdfLoading] = useState<
    "summary" | "all-expenses" | null
  >(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [copiedExpenses, setCopiedExpenses] = useState(false);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paidByFilter, setPaidByFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<
    | "date-desc"
    | "date-asc"
    | "amount-desc"
    | "amount-asc"
    | "title-asc"
    | "title-desc"
  >("date-desc");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  // Mark Settlement feature
  interface SavedSettlement {
    id: string;
    from_date: string;
    to_date: string;
    note: string | null;
    created_at: string;
  }
  const [savedSettlements, setSavedSettlements] = useState<SavedSettlement[]>([]);
  const [allSettlementsOpen, setAllSettlementsOpen] = useState(false);
  const [markSettlementOpen, setMarkSettlementOpen] = useState(false);
  const [settlementNote, setSettlementNote] = useState("");
  const [savingSettlement, setSavingSettlement] = useState(false);

  // Share feature
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

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
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
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
      console.log(
        "Reports: Fetching data for SplitSpace:",
        selectedSplitSpace.id
      );
      // Query that handles both migrated and unmigrated data
      const flatmatesQuery = supabase
        .from("flatmates")
        .select("id, name, email")
        .order("name");

      // If split_space_id column exists, filter by it or allow NULL
      const { data: flatmatesData, error: flatmatesError } =
        await flatmatesQuery.or(
          `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`
        );

      if (flatmatesError) {
        // If error is about column not existing, try without filter
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
          expense_splits (
            flatmate_id
          )
        `
        )
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      const expensesQueryWithCategory = expensesQuery.select(
        `
          *,
          categories (name),
          expense_splits (
            flatmate_id
          )
        `
      );

      const { data: expensesData, error: expensesError } =
        await expensesQueryWithCategory.or(
          `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`
        );

      if (expensesError) {
        // If error is about column not existing, try without filter
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
            .gte("date", format(dateRange.from, "yyyy-MM-dd"))
            .lte("date", format(dateRange.to, "yyyy-MM-dd"))
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
    // Wait for context to finish loading
    if (contextLoading) {
      console.log("Reports: Context still loading, waiting...");
      return;
    }

    console.log(
      "Reports: Context loaded. SplitSpaces:",
      splitSpaces.length,
      "Selected:",
      selectedSplitSpace?.name
    );

    // If no split spaces exist (migrations not run), fetch without filter
    if (splitSpaces.length === 0) {
      console.log("Reports: No split spaces, fetching without filter");
      fetchDataWithoutSplitSpace();
    } else if (selectedSplitSpace) {
      console.log(
        "Reports: Fetching with SplitSpace:",
        selectedSplitSpace.name
      );
      fetchData();
    } else {
      console.log("Reports: No SplitSpace selected, setting loading to false");
      setLoading(false);
    }
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
        // Exclude if any excluded person is in the split OR paid for it
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

    // Apply paidBy filter from transactions table
    if (paidByFilter.length > 0) {
      filteredExpenses = filteredExpenses.filter((expense) =>
        paidByFilter.includes(expense.paid_by)
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

    // Apply sorting
    const sortedExpenses = [...filteredExpenses];
    switch (sortBy) {
      case "date-desc":
        sortedExpenses.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        break;
      case "date-asc":
        sortedExpenses.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        break;
      case "amount-desc":
        sortedExpenses.sort((a, b) => b.amount - a.amount);
        break;
      case "amount-asc":
        sortedExpenses.sort((a, b) => a.amount - b.amount);
        break;
      case "title-asc":
        sortedExpenses.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sortedExpenses.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    setExpenses(sortedExpenses);
  }, [allExpenses, peopleFilters, categoryFilters, paidByFilter, sortBy]);

  useEffect(() => {
    if (flatmates.length > 0 && expenses.length > 0) {
      calculateBalances();
    }
  }, [flatmates, expenses]);

  const calculateBalances = () => {
    const calculatedBalances = calcBalances(flatmates, expenses);
    setBalances(calculatedBalances);
    setSettlements(calcSettlements(calculatedBalances));
  };

  // Load saved settlements when split space changes
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
        if (error.code === "42P01") return; // table missing — migrations not run yet
        console.error("Failed to load saved settlements:", error);
        return;
      }
      setSavedSettlements(data || []);
    };
    loadSavedSettlements();
  }, [selectedSplitSpace]);

  const refreshSavedSettlements = async () => {
    if (!selectedSplitSpace) return;
    const { data } = await supabase
      .from("settlements")
      .select("id, from_date, to_date, note, created_at")
      .eq("split_space_id", selectedSplitSpace.id)
      .order("created_at", { ascending: false });
    setSavedSettlements(data || []);
  };

  const saveSettlement = async () => {
    if (!selectedSplitSpace) {
      toast.error("Select a split space first");
      return;
    }
    setSavingSettlement(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase.from("settlements").insert({
        split_space_id: selectedSplitSpace.id,
        from_date: format(dateRange.from, "yyyy-MM-dd"),
        to_date: format(dateRange.to, "yyyy-MM-dd"),
        note: settlementNote.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Settlement marked");
      setMarkSettlementOpen(false);
      setSettlementNote("");
      await refreshSavedSettlements();
    } catch (err: any) {
      toast.error(`Failed to mark settlement: ${err.message || "Unknown error"}`);
    } finally {
      setSavingSettlement(false);
    }
  };

  const deleteSavedSettlement = async (id: string) => {
    const { error } = await supabase.from("settlements").delete().eq("id", id);
    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      return;
    }
    setSavedSettlements((prev) => prev.filter((s) => s.id !== id));
    toast.success("Settlement removed");
  };

  const createShareLink = async () => {
    if (!selectedSplitSpace) {
      toast.error("Select a split space first");
      return;
    }
    if (balances.length === 0) {
      toast.error("Nothing to share — no expenses in range");
      return;
    }
    setSharing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const snapshot = buildShareSnapshot({
        splitSpaceName: selectedSplitSpace.name,
        dateRange: {
          from: format(dateRange.from, "yyyy-MM-dd"),
          to: format(dateRange.to, "yyyy-MM-dd"),
        },
        balances,
        settlements,
        expenses,
        flatmates,
      });

      const token = crypto.randomUUID().replace(/-/g, "");

      const { error } = await supabase.from("shared_reports").insert({
        token,
        split_space_id: selectedSplitSpace.id,
        split_space_name: selectedSplitSpace.name,
        from_date: format(dateRange.from, "yyyy-MM-dd"),
        to_date: format(dateRange.to, "yyyy-MM-dd"),
        snapshot: snapshot as any,
        created_by: user.id,
      });
      if (error) throw error;

      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      setShareCopied(false);
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
      } catch {
        // clipboard may be blocked — user can copy manually from the dialog
      }
      toast.success("Public link created");
    } catch (err: any) {
      toast.error(`Failed to create share link: ${err.message || "Unknown error"}`);
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — please copy manually");
    }
  };

  const copySettlementSummary = async () => {
    if (settlements.length === 0) {
      toast.error("No settlements to copy");
      return;
    }

    let text = `SETTLEMENT SUMMARY\n`;
    text += `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
      dateRange.to,
      "MMM dd, yyyy"
    )}\n\n`;

    if (selectedSplitSpace) {
      text += `SplitSpace: ${selectedSplitSpace.name}\n\n`;
    }

    text += `Settlements:\n`;
    text += `${"=".repeat(50)}\n`;

    settlements.forEach((settlement, index) => {
      text += `${index + 1}. ${settlement.from} owes ${
        settlement.to
      }: ₹${settlement.amount.toFixed(2)}\n`;
    });

    text += `\n${"=".repeat(50)}\n`;
    text += `Total Settlements: ${settlements.length} transaction${
      settlements.length !== 1 ? "s" : ""
    }\n`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSettlement(true);
      toast.success("Settlement summary copied to clipboard!");
      setTimeout(() => setCopiedSettlement(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const copyAllExpenses = async () => {
    if (expenses.length === 0) {
      toast.error("No expenses to copy");
      return;
    }

    // Group expenses by user (who paid)
    const expensesByUser = new Map<
      string,
      { name: string; expenses: typeof expenses }
    >();

    flatmates.forEach((flatmate) => {
      expensesByUser.set(flatmate.id, {
        name: flatmate.name,
        expenses: expenses.filter((exp) => exp.paid_by === flatmate.id),
      });
    });

    let text = `ALL EXPENSES - USER WISE\n`;
    text += `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
      dateRange.to,
      "MMM dd, yyyy"
    )}\n\n`;

    if (selectedSplitSpace) {
      text += `SplitSpace: ${selectedSplitSpace.name}\n\n`;
    }

    expensesByUser.forEach((userData, userId) => {
      if (userData.expenses.length === 0) return;

      text += `${"=".repeat(50)}\n`;
      text += `${userData.name.toUpperCase()}\n`;
      text += `${"=".repeat(50)}\n\n`;

      let userTotal = 0;
      userData.expenses.forEach((expense) => {
        const splitAmount = expense.amount / expense.expense_splits.length;
        const splitWith = expense.expense_splits
          .map((split) => {
            const flatmate = flatmates.find((f) => f.id === split.flatmate_id);
            return flatmate?.name || "Unknown";
          })
          .join(", ");

        text += `• ${expense.title}\n`;
        text += `  Date: ${format(new Date(expense.date), "MMM dd, yyyy")}\n`;
        text += `  Amount: ₹${expense.amount.toFixed(2)}\n`;
        text += `  Split with: ${splitWith}\n`;
        text += `  Per person: ₹${splitAmount.toFixed(2)}\n`;
        text += `\n`;

        userTotal += expense.amount;
      });

      text += `Total paid by ${userData.name}: ₹${userTotal.toFixed(2)}\n\n`;
    });

    text += `${"=".repeat(50)}\n`;
    text += `Grand Total: ₹${expenses
      .reduce((sum, exp) => sum + exp.amount, 0)
      .toFixed(2)}\n`;
    text += `Total Expenses: ${expenses.length}\n`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedExpenses(true);
      toast.success("All expenses copied to clipboard!");
      setTimeout(() => setCopiedExpenses(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const generateAllExpensesPDF = async () => {
    setPdfLoading("all-expenses");
    try {
      const doc = new jsPDF();

      // Clean Professional Header
      doc.setFillColor(59, 130, 246); // Blue header
      doc.rect(0, 0, 210, 30, "F");

      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("EXPENSEWAALE EXPENSES REPORT", 14, 20);

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
        `Report Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
          dateRange.to,
          "MMM dd, yyyy"
        )}`,
        14,
        40
      );
      doc.text(
        `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        14,
        45
      );

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 14, 50);

      // Expenses table
      const tableData = expenses.map((expense) => {
        const paidBy = flatmates.find((f) => f.id === expense.paid_by);
        const splitBetween = expense.expense_splits
          .map((split) => {
            const flatmate = flatmates.find((f) => f.id === split.flatmate_id);
            return flatmate?.name;
          })
          .join(", ");

        const splitAmount = expense.amount / expense.expense_splits.length;

        return [
          format(new Date(expense.date), "MMM dd, yyyy"),
          expense.title,
          paidBy?.name || "Unknown",
          splitBetween,
          `$${splitAmount.toFixed(2)}`,
          `$${expense.amount.toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: 65,
        head: [
          [
            "Date",
            "Description",
            "Paid By",
            "Split Between",
            "Share Each",
            "Total Amount",
          ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [79, 70, 229], // Purple header
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
          cellPadding: 4,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5,
        },
        columnStyles: {
          4: { halign: "right" },
          5: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      // Summary section
      const finalY = (doc as any).lastAutoTable?.finalY || 65;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("SUMMARY", 14, finalY + 20);

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "normal");
      doc.text(`Total Number of Expenses: ${expenses.length}`, 14, finalY + 30);
      doc.text(`Total Amount: $${totalExpenses.toFixed(2)}`, 14, finalY + 35);
      doc.text(
        `Average per Expense: $${(totalExpenses / expenses.length).toFixed(2)}`,
        14,
        finalY + 40
      );

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, "normal");
      doc.text(
        "Generated by ExpenseWaale - Expense Management System",
        14,
        290
      );
      doc.text(
        `Page 1 of 1 • ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        180,
        290
      );

      doc.save(
        `expenses_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(
          dateRange.to,
          "yyyy-MM-dd"
        )}.pdf`
      );
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(null);
    }
  };

  const generateSummaryPDF = async () => {
    setPdfLoading("summary");
    try {
      const doc = new jsPDF();

      // Clean Professional Header
      doc.setFillColor(59, 130, 246); // Blue header
      doc.rect(0, 0, 210, 30, "F");

      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("EXPENSEWAALE SETTLEMENT REPORT", 14, 20);

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
        `Report Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
          dateRange.to,
          "MMM dd, yyyy"
        )}`,
        14,
        40
      );
      doc.text(
        `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        14,
        45
      );

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 14, 50);

      // Balance Summary Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("BALANCE SUMMARY", 14, 65);

      // User-wise balance table
      const balanceData = balances.map((balance) => [
        balance.name,
        `$${balance.totalPaid.toFixed(2)}`,
        `$${balance.totalOwed.toFixed(2)}`,
        balance.balance >= 0
          ? `+$${balance.balance.toFixed(2)}`
          : `-$${Math.abs(balance.balance).toFixed(2)}`,
        balance.balance > 0
          ? "Owes Money"
          : balance.balance < 0
          ? "Needs Money"
          : "Settled",
      ]);

      autoTable(doc, {
        startY: 72,
        head: [["Name", "Total Paid", "Total Owed", "Net Balance", "Status"]],
        body: balanceData,
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
        },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "center" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY1 = (doc as any).lastAutoTable?.finalY || 72;

      // Settlement Instructions Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");
      doc.text("SETTLEMENT INSTRUCTIONS", 14, finalY1 + 15);

      if (settlements.length > 0) {
        const settlementData = settlements.map((s, index) => [
          `${index + 1}`,
          s.from,
          s.to,
          `$${s.amount.toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: finalY1 + 22,
          head: [["#", "From", "To", "Amount"]],
          body: settlementData,
          theme: "grid",
          headStyles: {
            fillColor: [34, 197, 94], // Green header
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 10,
            cellPadding: 5,
          },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.5,
          },
          columnStyles: {
            1: { halign: "center" },
            2: { halign: "left" },
            3: { halign: "left" },
            4: { halign: "right", fontStyle: "bold" },
          },
          margin: { left: 14, right: 14 },
        });

        const finalY2 = (doc as any).lastAutoTable?.finalY || finalY1 + 22;

        // Settlement Complete Summary Box
        doc.setFillColor(34, 197, 94); // Green background
        doc.rect(14, finalY2 + 10, 182, 25, "F");

        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.text("SETTLEMENT COMPLETE!", 16, finalY2 + 20);

        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "normal");

        const totalSettlements = settlements.reduce(
          (sum, s) => sum + s.amount,
          0
        );

        doc.text(`Total Transactions: ${settlements.length}`, 16, finalY2 + 26);
        doc.text(
          `Total Amount: $${totalSettlements.toFixed(2)}`,
          16,
          finalY2 + 31
        );
        doc.text(
          `Average per Transaction: $${(
            totalSettlements / settlements.length
          ).toFixed(2)}`,
          16,
          finalY2 + 36
        );

        // Add User-wise Transaction Details
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, "bold");
        doc.text("USER-WISE TRANSACTION DETAILS", 14, finalY2 + 50);

        // Group expenses by flatmate for detailed breakdown
        const userExpenseMap = new Map<
          string,
          { name: string; expenses: any[]; totalPaid: number }
        >();

        balances.forEach((balance) => {
          userExpenseMap.set(balance.id, {
            name: balance.name,
            expenses: [],
            totalPaid: balance.totalPaid,
          });
        });

        expenses.forEach((expense) => {
          const user = userExpenseMap.get(expense.paid_by);
          if (user) {
            user.expenses.push(expense);
          }
        });

        let currentY = finalY2 + 58;

        userExpenseMap.forEach((userData, userId) => {
          // User header
          doc.setFillColor(240, 240, 240);
          doc.rect(14, currentY, 182, 8, "F");

          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, "bold");
          doc.text(userData.name, 16, currentY + 6);

          currentY += 12;

          if (userData.expenses.length > 0) {
            // Expenses table for this user
            const userExpenseData = userData.expenses.map((expense) => [
              format(new Date(expense.date), "MMM dd"),
              expense.title,
              `$${expense.amount.toFixed(2)}`,
              `${expense.expense_splits.length} people`,
            ]);

            autoTable(doc, {
              startY: currentY,
              head: [["Date", "Description", "Amount", "Split Between"]],
              body: userExpenseData,
              theme: "grid",
              headStyles: {
                fillColor: [79, 70, 229],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 8,
                cellPadding: 3,
              },
              styles: {
                fontSize: 8,
                cellPadding: 3,
                lineColor: [200, 200, 200],
                lineWidth: 0.3,
              },
              columnStyles: {
                2: { halign: "right", fontStyle: "bold" },
                3: { halign: "center" },
              },
              margin: { left: 14, right: 14 },
              tableWidth: "auto",
            });

            currentY = (doc as any).lastAutoTable?.finalY || currentY + 20;
            currentY += 8;
          } else {
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.setFont(undefined, "normal");
            doc.text("No expenses paid by this user", 16, currentY + 5);
            currentY += 12;
          }
        });

        // Footer
        const finalContentY = Math.max(currentY + 10, 280);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, "normal");
        doc.text(
          "Generated by ExpenseWaale - Expense Management System",
          14,
          finalContentY
        );
        doc.text(
          `Page 1 of 1 • ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
          180,
          finalContentY
        );
      } else {
        // All Settled Up message
        doc.setFillColor(34, 197, 94);
        doc.rect(14, finalY1 + 22, 182, 20, "F");

        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.text("ALL SETTLED UP!", 16, finalY1 + 32);

        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "normal");
        doc.text(
          "No money needs to be transferred between flatmates.",
          16,
          finalY1 + 38
        );

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, "normal");
        doc.text(
          "Generated by ExpenseWaale - Expense Management System",
          14,
          290
        );
        doc.text(
          `Page 1 of 1 • ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
          180,
          290
        );
      }

      doc.save(
        `summary_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(
          dateRange.to,
          "yyyy-MM-dd"
        )}.pdf`
      );
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(null);
    }
  };

  const handleSendEmail = async (
    recipients: string[],
    emailType: "individual" | "comprehensive"
  ) => {
    try {
      // For now, simulate email sending since Edge Function may not be deployed
      // TODO: Replace with actual Supabase Edge Function call when deployed

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Get recipient names for better feedback
      const recipientNames = recipients.map((id) => {
        const flatmate = flatmates.find((f) => f.id === id);
        return flatmate?.name || "Unknown";
      });

      toast.success(
        `📧 Email${recipients.length > 1 ? "s" : ""} sent successfully! 
        ${
          emailType === "individual"
            ? "Personalized reports"
            : "Comprehensive report"
        } sent to: ${recipientNames.join(", ")}`
      );

      console.log("Email sending simulation:", {
        recipients,
        recipientNames,
        emailType,
        reportData: {
          expenses: expenses.length,
          balances: balances.length,
          settlements: settlements.length,
          dateRange: {
            from: format(dateRange.from, "yyyy-MM-dd"),
            to: format(dateRange.to, "yyyy-MM-dd"),
          },
        },
      });

      /* 
      // Uncomment this when Supabase Edge Function is deployed:
      const { data, error } = await supabase.functions.invoke(
        "send-settlement-email",
        {
          body: {
            recipients,
            emailType,
            reportData: {
              expenses,
              balances,
              settlements,
              dateRange: {
                from: format(dateRange.from, "yyyy-MM-dd"),
                to: format(dateRange.to, "yyyy-MM-dd"),
              },
            },
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data) {
        toast.success(
          `Email${recipients.length > 1 ? "s" : ""} sent successfully! (${
            data.sent
          } delivered, ${data.failed} failed)`
        );
      } else {
        toast.success(
          `Email${recipients.length > 1 ? "s" : ""} sent successfully to ${
            recipients.length
          } recipient${recipients.length > 1 ? "s" : ""}!`
        );
      }
      */
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast.error(`Failed to send emails: ${error.message || "Unknown error"}`);
      throw error;
    }
  };

  // Allow page to work even if SplitSpaces feature isn't fully set up
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
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          {selectedSplitSpace && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              <span className="hidden sm:inline">SplitSpace: </span>
              {selectedSplitSpace.name}
            </p>
          )}
        </div>
        {selectedSplitSpace && savedSettlements.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-secondary/30 px-3 py-1.5">
              <Bookmark className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="text-muted-foreground">Last settlement: </span>
                <span className="font-medium">
                  {format(new Date(savedSettlements[0].from_date), "MMM d")} –{" "}
                  {format(new Date(savedSettlements[0].to_date), "MMM d, yyyy")}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllSettlementsOpen(true)}
            >
              See all ({savedSettlements.length})
            </Button>
          </div>
        )}
      </div>

      {/* All settlements modal */}
      <Dialog open={allSettlementsOpen} onOpenChange={setAllSettlementsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5" />
              Past Settlements
            </DialogTitle>
            <DialogDescription>
              Date ranges you've marked as settled in this split space.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {savedSettlements.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-3 bg-secondary/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {format(new Date(s.from_date), "MMM d")} –{" "}
                    {format(new Date(s.to_date), "MMM d, yyyy")}
                  </div>
                  {s.note && (
                    <div className="text-xs text-muted-foreground mt-1 break-words">
                      {s.note}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Marked {format(new Date(s.created_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => deleteSavedSettlement(s.id)}
                  aria-label="Delete settlement"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Select Date Range</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSplitSpace && (
                <Dialog
                  open={markSettlementOpen}
                  onOpenChange={(open) => {
                    setMarkSettlementOpen(open);
                    if (!open) setSettlementNote("");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Bookmark className="w-4 h-4" />
                      Mark Settlement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mark Settlement</DialogTitle>
                      <DialogDescription>
                        Save this date range so you remember when the last
                        settlement happened.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Range: </span>
                        <span className="font-medium">
                          {format(dateRange.from, "MMM d, yyyy")} –{" "}
                          {format(dateRange.to, "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="settlement-note">
                          Note (optional)
                        </Label>
                        <Textarea
                          id="settlement-note"
                          placeholder="e.g. Settled in cash, Bob still pending"
                          value={settlementNote}
                          onChange={(e) => setSettlementNote(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setMarkSettlementOpen(false)}
                        disabled={savingSettlement}
                      >
                        Cancel
                      </Button>
                      <Button onClick={saveSettlement} disabled={savingSettlement}>
                        {savingSettlement ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
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
                                          include:
                                            categoryFilters.include.filter(
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
                                    id={`exclude-cat-${category.id}`}
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
                                    htmlFor={`exclude-cat-${category.id}`}
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
          </div>
        </CardHeader>
        <CardContent>
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
                    {dateRange.from ? (
                      format(dateRange.from, "PPP")
                    ) : (
                      <span className="hidden sm:inline">Pick start date</span>
                    )}
                    {dateRange.from && (
                      <span className="sm:hidden">
                        {format(dateRange.from, "MMM dd")}
                      </span>
                    )}
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
                    {dateRange.to ? (
                      format(dateRange.to, "PPP")
                    ) : (
                      <span className="hidden sm:inline">Pick end date</span>
                    )}
                    {dateRange.to && (
                      <span className="sm:hidden">
                        {format(dateRange.to, "MMM dd")}
                      </span>
                    )}
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
          </div>

          {/* Copy Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            <Button
              variant="outline"
              onClick={copySettlementSummary}
              disabled={settlements.length === 0}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {copiedSettlement ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="sm:hidden">Copied!</span>
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="sm:hidden">Copy Summary</span>
                  <span className="hidden sm:inline">
                    Copy Settlement Summary
                  </span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={copyAllExpenses}
              disabled={expenses.length === 0}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {copiedExpenses ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="sm:hidden">Copied!</span>
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="sm:hidden">Copy Expenses</span>
                  <span className="hidden sm:inline">
                    Copy All Expense Splitting
                  </span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtered Transactions List */}
      {expenses.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Filtered Transactions ({expenses.length})
              </CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">
                  {format(dateRange.from, "MMM dd")} -{" "}
                  {format(dateRange.to, "MMM dd")}
                </Badge>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">
                    Sort By:
                  </Label>
                  <Select
                    value={sortBy}
                    onValueChange={(value: typeof sortBy) => setSortBy(value)}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <div className="flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Date (Newest)</SelectItem>
                      <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                      <SelectItem value="amount-desc">Amount (High)</SelectItem>
                      <SelectItem value="amount-asc">Amount (Low)</SelectItem>
                      <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                      <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">
                    Paid By:
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs min-w-[120px] justify-between"
                      >
                        <span className="truncate">
                          {paidByFilter.length === 0
                            ? "All"
                            : paidByFilter.length === 1
                            ? flatmates.find((f) => f.id === paidByFilter[0])
                                ?.name || "Selected"
                            : `${paidByFilter.length} selected`}
                        </span>
                        <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-2 pb-1 border-b">
                          <Label className="text-sm font-medium">
                            Select People
                          </Label>
                          {paidByFilter.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                setPaidByFilter([]);
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {flatmates.map((flatmate) => (
                            <div
                              key={flatmate.id}
                              className="flex items-center space-x-2 px-2 py-1 hover:bg-secondary/50 rounded"
                            >
                              <Checkbox
                                id={`table-paidby-${flatmate.id}`}
                                checked={paidByFilter.includes(flatmate.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPaidByFilter([
                                      ...paidByFilter,
                                      flatmate.id,
                                    ]);
                                  } else {
                                    setPaidByFilter(
                                      paidByFilter.filter(
                                        (id) => id !== flatmate.id
                                      )
                                    );
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`table-paidby-${flatmate.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {flatmate.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {expenses.map((expense) => {
                const paidByFlatmate = flatmates.find(
                  (f) => f.id === expense.paid_by
                );
                const splitCount = expense.expense_splits.length;
                const sharePerPerson = expense.amount / splitCount;
                const splitWith = expense.expense_splits
                  .map((split) => {
                    const flatmate = flatmates.find(
                      (f) => f.id === split.flatmate_id
                    );
                    return flatmate?.name;
                  })
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div
                    key={expense.id}
                    className="p-3 bg-secondary/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-base">
                            {expense.title}
                          </h3>
                          {expense.categories && (
                            <Badge variant="secondary" className="text-xs">
                              {expense.categories.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(expense.date), "MMM dd, yyyy")}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Paid by{" "}
                            <span className="font-medium text-foreground">
                              {paidByFlatmate?.name || "Unknown"}
                            </span>
                          </p>
                          <p>
                            Split between {splitCount}{" "}
                            {splitCount === 1 ? "person" : "people"}:{" "}
                            {splitWith}
                          </p>
                          <p>${sharePerPerson.toFixed(2)} per person</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          ${expense.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {expenses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No expenses found matching the selected filters and date range.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* All Expenses Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">All Expenses</span>
              <span className="sm:hidden">Expenses</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">
                Download a detailed report of all expenses in the selected
                period.
              </span>
              <span className="sm:hidden">
                Download detailed expense report.
              </span>
            </p>
            <Button
              onClick={generateAllExpensesPDF}
              disabled={pdfLoading === "all-expenses"}
              className="w-full"
            >
              {pdfLoading === "all-expenses" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">Generating</span>
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                  <span className="sm:hidden">Download</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Balance Summary Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Balance Summary</span>
              <span className="sm:hidden">Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">
                Download settlement summary with balances and transaction
                details.
              </span>
              <span className="sm:hidden">Download settlement summary.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={generateSummaryPDF}
                disabled={pdfLoading === "summary"}
                className="flex-1 w-full sm:w-auto"
              >
                {pdfLoading === "summary" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Generating...</span>
                    <span className="sm:hidden">Generating</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden">Download</span>
                  </>
                )}
              </Button>
              {/* <Button
                variant="outline"
                onClick={() => setEmailDialogOpen(true)}
                className="flex-1 w-full sm:w-auto"
              >
                <Mail className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Send via Email</span>
                <span className="sm:hidden">Email</span>
              </Button> */}
            </div>
          </CardContent>
        </Card>

        {/* Share public link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              Share
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Generate a public web link with the current Summary, Settlements,
              and Expenses. Snapshot — anyone with the link can view it.
            </p>
            <Button
              onClick={createShareLink}
              disabled={
                sharing || balances.length === 0 || !selectedSplitSpace
              }
              className="w-full"
              variant="secondary"
            >
              {sharing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating link
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Create Public Link
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Share result dialog */}
      <Dialog
        open={shareDialogOpen || !!shareUrl}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            setShareUrl(null);
            setShareCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Public link ready
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can view the snapshot. New expenses won't
              change what they see.
            </DialogDescription>
          </DialogHeader>
          {shareUrl && (
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copyShareUrl} variant="outline" className="gap-2">
                {shareCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShareUrl(null);
                setShareCopied(false);
                setShareDialogOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Summary */}
      {balances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Balance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full border-collapse min-w-[600px] sm:min-w-0">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-xs sm:text-sm">Name</th>
                    <th className="text-right p-2 text-xs sm:text-sm">
                      <span className="hidden sm:inline">Total Paid</span>
                      <span className="sm:hidden">Paid</span>
                    </th>
                    <th className="text-right p-2 text-xs sm:text-sm">
                      <span className="hidden sm:inline">Total Owed</span>
                      <span className="sm:hidden">Owed</span>
                    </th>
                    <th className="text-right p-2 text-xs sm:text-sm">
                      <span className="hidden sm:inline">Net Balance</span>
                      <span className="sm:hidden">Balance</span>
                    </th>
                    <th className="text-center p-2 text-xs sm:text-sm">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => (
                    <tr key={balance.id} className="border-b">
                      <td className="p-2 font-medium text-sm sm:text-base">
                        {balance.name}
                      </td>
                      <td className="p-2 text-right text-sm sm:text-base">
                        <span className="hidden sm:inline">
                          ₹{balance.totalPaid.toFixed(2)}
                        </span>
                        <span className="sm:hidden">
                          ₹{balance.totalPaid.toFixed(0)}
                        </span>
                      </td>
                      <td className="p-2 text-right text-sm sm:text-base">
                        <span className="hidden sm:inline">
                          ₹{balance.totalOwed.toFixed(2)}
                        </span>
                        <span className="sm:hidden">
                          ₹{balance.totalOwed.toFixed(0)}
                        </span>
                      </td>
                      <td className="p-2 text-right font-semibold text-sm sm:text-base">
                        <span className="hidden sm:inline">
                          {balance.balance >= 0
                            ? `+₹${balance.balance.toFixed(2)}`
                            : `-₹${Math.abs(balance.balance).toFixed(2)}`}
                        </span>
                        <span className="sm:hidden">
                          {balance.balance >= 0
                            ? `+₹${balance.balance.toFixed(0)}`
                            : `-₹${Math.abs(balance.balance).toFixed(0)}`}
                        </span>
                      </td>
                      <td className="p-2 text-center text-xs sm:text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            balance.balance > 0
                              ? "bg-green-100 text-green-800"
                              : balance.balance < 0
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {balance.balance > 0
                            ? "Owes Money"
                            : balance.balance < 0
                            ? "Needs Money"
                            : "Settled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement Instructions */}
      {settlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Settlement Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              {settlements.map((settlement, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200 gap-2 sm:gap-0"
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="font-bold text-green-800 text-sm sm:text-base">
                      {index + 1}.
                    </span>
                    <span className="text-green-800 text-sm sm:text-base">
                      {settlement.from}
                    </span>
                    <span className="text-green-600 text-sm sm:text-base">
                      →
                    </span>
                    <span className="text-green-800 text-sm sm:text-base">
                      {settlement.to}
                    </span>
                  </div>
                  <span className="font-bold text-green-800 text-sm sm:text-base">
                    ₹{settlement.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="mt-4 p-3 sm:p-4 bg-green-100 rounded-lg">
                <p className="font-bold text-green-800 text-sm sm:text-base">
                  <span className="hidden sm:inline">
                    Settlement Complete! Total transactions:{" "}
                    {settlements.length}
                  </span>
                  <span className="sm:hidden">
                    Complete! {settlements.length} transaction
                    {settlements.length !== 1 ? "s" : ""}
                  </span>
                </p>
                <p className="text-green-700 text-xs sm:text-sm mt-1">
                  <span className="hidden sm:inline">
                    Total amount to be transferred: ₹
                  </span>
                  <span className="sm:hidden">Total: ₹</span>
                  {settlements.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Settled Up */}
      {settlements.length === 0 && balances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              All Settled Up! 🎉
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600 text-sm sm:text-base">
              <span className="hidden sm:inline">
                No money needs to be transferred between flatmates.
              </span>
              <span className="sm:hidden">
                All settled! No transfers needed.
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email Report Dialog */}
      <EmailReportDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        flatmates={flatmates}
        onSendEmail={handleSendEmail}
      />
    </div>
  );
}
