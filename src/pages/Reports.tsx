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
import { addDays, endOfMonth, format, isSameDay, startOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EmailReportDialog from "@/components/EmailReportDialog";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { PeopleFilters } from "@/components/PeopleFilters";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
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
import { useExpenseDialog } from "@/contexts/ExpenseDialogContext";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettleUpList } from "@/components/balances/SettleUpList";
import { BalanceList } from "@/components/balances/BalanceList";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { formatMoney, parseDay } from "@/lib/format";
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
import {
  PDF_COLORS,
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  drawBody,
  tableStyles,
  accentTableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";

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
  const [settlementToDelete, setSettlementToDelete] = useState<string | null>(null);
  const { dataVersion } = useExpenseDialog();

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
      return;
    }


    // If no split spaces exist (migrations not run), fetch without filter
    if (splitSpaces.length === 0) {
      fetchDataWithoutSplitSpace();
    } else if (selectedSplitSpace) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedSplitSpace, splitSpaces.length, contextLoading, dataVersion]);

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
    calculateBalances();
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
      const doc = createPdfDoc();
      const period = `${format(dateRange.from, "MMM d, yyyy")} – ${format(
        dateRange.to,
        "MMM d, yyyy"
      )}`;

      let y = drawPdfHeader(doc, {
        title: "Expenses Report",
        subtitle: selectedSplitSpace ? selectedSplitSpace.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });

      y = drawBody(doc, `Period: ${period}`, y, { muted: true });
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      y = drawBody(doc, `Total: ${pdfAmount(totalExpenses)}  ·  ${expenses.length} expenses`, y, {
        muted: true,
      });
      y += 4;

      const tableData = expenses.map((expense) => {
        const paidBy = flatmates.find((f) => f.id === expense.paid_by);
        const splitBetween = expense.expense_splits
          .map((split) => flatmates.find((f) => f.id === split.flatmate_id)?.name)
          .filter(Boolean)
          .join(", ");
        const splitAmount = expense.amount / expense.expense_splits.length;
        return [
          format(new Date(expense.date), "MMM d, yyyy"),
          expense.title,
          paidBy?.name || "Unknown",
          splitBetween,
          pdfAmount(splitAmount),
          pdfAmount(expense.amount),
        ];
      });

      autoTable(doc, {
        ...tableStyles({
          startY: y,
          head: [["Date", "Description", "Paid By", "Split Between", "Per Person", "Total"]],
          body: tableData,
          columnStyles: {
            0: { cellWidth: 18 },
            4: { halign: "right", cellWidth: 22 },
            5: { halign: "right", fontStyle: "bold", cellWidth: 24 },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY = (doc as any).lastAutoTable?.finalY || y;
      const summaryY = finalY + 12;

      drawSectionTitle(doc, "Summary", summaryY);
      drawBody(doc, `Total expenses: ${expenses.length}`, summaryY + 8);
      drawBody(doc, `Total amount: ${pdfAmount(totalExpenses)}`, summaryY + 14);
      if (expenses.length > 0) {
        drawBody(
          doc,
          `Average per expense: ${pdfAmount(totalExpenses / expenses.length)}`,
          summaryY + 20
        );
      }

      drawPdfFooter(doc);

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
      const doc = createPdfDoc();
      const period = `${format(dateRange.from, "MMM d, yyyy")} – ${format(
        dateRange.to,
        "MMM d, yyyy"
      )}`;

      let y = drawPdfHeader(doc, {
        title: "Settlement Report",
        subtitle: selectedSplitSpace ? selectedSplitSpace.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });

      y = drawBody(doc, `Period: ${period}`, y, { muted: true });
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      y = drawBody(doc, `Total expenses: ${pdfAmount(totalExpenses)}`, y, { muted: true });
      y += 4;

      y = drawSectionTitle(doc, "Balance Summary", y);

      const balanceData = balances.map((balance) => [
        balance.name,
        pdfAmount(balance.totalPaid),
        pdfAmount(balance.totalOwed),
        balance.balance >= 0
          ? `+${pdfAmount(balance.balance)}`
          : `-${pdfAmount(Math.abs(balance.balance))}`,
        balance.balance > 0.01
          ? "Is owed"
          : balance.balance < -0.01
          ? "Owes"
          : "Settled",
      ]);

      autoTable(doc, {
        ...tableStyles({
          startY: y + 2,
          head: [["Name", "Paid", "Owed", "Net", "Status"]],
          body: balanceData,
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right", fontStyle: "bold" },
            4: { halign: "center" },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY1 = (doc as any).lastAutoTable?.finalY || y;

      if (settlements.length > 0) {
        let cursorY = drawSectionTitle(doc, "Settlement Instructions", finalY1 + 12);

        const settlementData = settlements.map((s, index) => [
          `${index + 1}`,
          s.from,
          s.to,
          pdfAmount(s.amount),
        ]);

        autoTable(doc, {
          ...accentTableStyles({
            startY: cursorY + 2,
            head: [["#", "From", "To", "Amount"]],
            body: settlementData,
            columnStyles: {
              0: { halign: "center", cellWidth: 14 },
              1: { halign: "left" },
              2: { halign: "left" },
              3: { halign: "right", fontStyle: "bold" },
            },
            didDrawPage: () => drawPdfFooter(doc),
          }),
        });

        const finalY2 = (doc as any).lastAutoTable?.finalY || cursorY;
        const totalSettlements = settlements.reduce((s, x) => s + x.amount, 0);

        // Sage callout box
        doc.setFillColor(...PDF_COLORS.accent);
        doc.roundedRect(14, finalY2 + 8, 182, 22, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Settlement Plan Ready", 18, finalY2 + 16);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `${settlements.length} transactions  ·  ${pdfAmount(totalSettlements)} total  ·  ${pdfAmount(
            totalSettlements / settlements.length
          )} avg`,
          18,
          finalY2 + 24
        );

        // User-wise breakdown
        cursorY = drawSectionTitle(doc, "User-wise Transaction Details", finalY2 + 42);

        type UserBreak = { name: string; expenses: typeof expenses; totalPaid: number };
        const userExpenseMap = new Map<string, UserBreak>();
        balances.forEach((balance) => {
          userExpenseMap.set(balance.id, {
            name: balance.name,
            expenses: [],
            totalPaid: balance.totalPaid,
          });
        });
        expenses.forEach((expense) => {
          const u = userExpenseMap.get(expense.paid_by);
          if (u) u.expenses.push(expense);
        });

        userExpenseMap.forEach((userData) => {
          // User name banner
          doc.setFillColor(...PDF_COLORS.surfaceAlt);
          doc.rect(14, cursorY, 182, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...PDF_COLORS.text);
          doc.text(
            `${userData.name}  ·  Total paid ${pdfAmount(userData.totalPaid)}`,
            16,
            cursorY + 6
          );
          cursorY += 11;

          if (userData.expenses.length > 0) {
            const userExpenseData = userData.expenses.map((e) => [
              format(new Date(e.date), "MMM d"),
              e.title,
              pdfAmount(e.amount),
              `${e.expense_splits.length} people`,
            ]);

            autoTable(doc, {
              ...tableStyles({
                startY: cursorY,
                head: [["Date", "Description", "Amount", "Split"]],
                body: userExpenseData,
                styles: {
                  font: "helvetica",
                  fontSize: 8,
                  cellPadding: 2.5,
                  textColor: PDF_COLORS.text,
                  lineColor: PDF_COLORS.border,
                  lineWidth: 0.1,
                },
                headStyles: {
                  fillColor: PDF_COLORS.primary,
                  textColor: [255, 255, 255],
                  fontStyle: "bold",
                  fontSize: 8.5,
                  halign: "left",
                },
                columnStyles: {
                  2: { halign: "right", fontStyle: "bold" },
                  3: { halign: "center" },
                },
                didDrawPage: () => drawPdfFooter(doc),
              }),
            });

            cursorY = (doc as any).lastAutoTable?.finalY || cursorY + 12;
            cursorY += 6;
          } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(...PDF_COLORS.textMuted);
            doc.text("No expenses paid by this user", 16, cursorY + 5);
            cursorY += 12;
          }

          // Page-break safety
          if (cursorY > 270) {
            drawPdfFooter(doc);
            doc.addPage();
            cursorY = 20;
          }
        });
      } else {
        // All Settled callout
        doc.setFillColor(...PDF_COLORS.accent);
        doc.roundedRect(14, finalY1 + 14, 182, 22, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text("All Settled Up", 18, finalY1 + 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No money needs to be transferred between flatmates.", 18, finalY1 + 30);
      }

      drawPdfFooter(doc);

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

  const activeFilterCount =
    peopleFilters.exactMatch.length +
    peopleFilters.anyMatch.length +
    peopleFilters.exclude.length +
    peopleFilters.paidBy.length +
    categoryFilters.include.length +
    categoryFilters.exclude.length;

  const nameById = new Map(flatmates.map((f) => [f.id, f.name]));
  const totalInRange = expenses.reduce((sum, e) => sum + e.amount, 0);
  const lastSettlement = savedSettlements[0];

  const today = new Date();
  const presets: { label: string; from: Date; to: Date }[] = [
    { label: "This month", from: startOfMonth(today), to: today },
    {
      label: "Last month",
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1)),
    },
    { label: "Last 3 months", from: startOfMonth(subMonths(today, 2)), to: today },
  ];
  if (lastSettlement) {
    const after = addDays(parseDay(lastSettlement.to_date), 1);
    if (after <= today) {
      presets.unshift({ label: "Since last settlement", from: after, to: today });
    }
  }
  const isPreset = (p: { from: Date; to: Date }) =>
    isSameDay(p.from, dateRange.from) && isSameDay(p.to, dateRange.to);

  // Allow page to work even if SplitSpaces feature isn't fully set up
  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Pick a SplitSpace to continue.</p>
      </div>
    );
  }

  // Full-page spinner only on first load; later date changes refresh in place.
  if (loading && flatmates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const datePick = (which: "from" | "to") => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 flex-1 justify-start font-normal sm:w-[170px] sm:flex-none">
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {format(dateRange[which], "d MMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateRange[which]}
          onSelect={(date) => date && setDateRange({ ...dateRange, [which]: date })}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Settle up"
        description="Who pays whom for a period — then mark it settled, export or share it."
        actions={
          <>
            {flatmates.length > 0 && (
              <Dialog open={filtersModalOpen} onOpenChange={setFiltersModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1.5">{activeFilterCount}</Badge>
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
                      Narrow down by people or category. Balances and payments below use only the matching expenses.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-2">
                    <PeopleFilters
                      key={JSON.stringify(peopleFilters)}
                      flatmates={flatmates}
                      value={peopleFilters}
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
                    <Button variant="outline" onClick={() => resetFilters()}>
                      <X className="w-4 h-4 mr-2" />
                      Reset all
                    </Button>
                    <Button onClick={() => setFiltersModalOpen(false)}>Done</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {selectedSplitSpace && (
              <Dialog
                open={markSettlementOpen}
                onOpenChange={(open) => {
                  setMarkSettlementOpen(open);
                  if (!open) setSettlementNote("");
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Bookmark className="w-4 h-4" />
                    Mark as settled
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark this period as settled</DialogTitle>
                    <DialogDescription>
                      Saves the date range as paid up. The Overview then only counts expenses after it. Nothing is
                      deleted.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-secondary/60 p-3 text-sm">
                      <span className="text-muted-foreground">Period: </span>
                      <span className="font-medium">
                        {format(dateRange.from, "d MMM yyyy")} – {format(dateRange.to, "d MMM yyyy")}
                      </span>
                      {settlements.length > 0 && (
                        <p className="mt-1 text-muted-foreground">
                          {settlements.length} payment{settlements.length === 1 ? "" : "s"} totalling{" "}
                          {formatMoney(settlements.reduce((s, x) => s + x.amount, 0))}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settlement-note">Note (optional)</Label>
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
                    <Button variant="outline" onClick={() => setMarkSettlementOpen(false)} disabled={savingSettlement}>
                      Cancel
                    </Button>
                    <Button onClick={saveSettlement} disabled={savingSettlement}>
                      {savingSettlement ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        "Mark as settled"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      {/* Period */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              {datePick("from")}
              <span className="text-sm text-muted-foreground">to</span>
              {datePick("to")}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDateRange({ from: p.from, to: p.to })}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isPreset(p)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {(lastSettlement || activeFilterCount > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              {lastSettlement && (
                <span className="flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" />
                  Last settled: {format(parseDay(lastSettlement.from_date), "d MMM")} –{" "}
                  {format(parseDay(lastSettlement.to_date), "d MMM yyyy")}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => setAllSettlementsOpen(true)}
                  >
                    History ({savedSettlements.length})
                  </button>
                </span>
              )}
              {activeFilterCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <Filter className="h-3.5 w-3.5" />
                  {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} applied — totals cover matching
                  expenses only.
                  <button type="button" className="font-medium text-primary hover:underline" onClick={resetFilters}>
                    Clear
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No expenses in this period</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFilterCount > 0 ? "Try clearing filters or " : "Try "}a different date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={cn("grid gap-5 sm:gap-6 lg:grid-cols-5", loading && "opacity-60 transition-opacity")}>
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Who pays whom</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(totalInRange)} across {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copySettlementSummary}
                    disabled={settlements.length === 0}
                    className="shrink-0 gap-1.5"
                  >
                    {copiedSettlement ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedSettlement ? "Copied" : "Copy"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SettleUpList settlements={settlements} />
                {settlements.length > 1 && (
                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    {settlements.length} payments, {formatMoney(settlements.reduce((s, x) => s + x.amount, 0))} in
                    total — the fewest transfers that square everyone up.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Balances</CardTitle>
                <p className="text-xs text-muted-foreground">Paid minus their share of each expense.</p>
              </CardHeader>
              <CardContent>
                <BalanceList balances={balances} />
              </CardContent>
            </Card>
          </div>

          {/* Transactions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">
                  Expenses <span className="text-sm font-normal text-muted-foreground">({expenses.length})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                    <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Sort expenses">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="w-3 h-3" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Newest first</SelectItem>
                      <SelectItem value="date-asc">Oldest first</SelectItem>
                      <SelectItem value="amount-desc">Highest amount</SelectItem>
                      <SelectItem value="amount-asc">Lowest amount</SelectItem>
                      <SelectItem value="title-asc">Title A–Z</SelectItem>
                      <SelectItem value="title-desc">Title Z–A</SelectItem>
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 min-w-[120px] justify-between text-xs">
                        <span className="truncate">
                          Paid by:{" "}
                          {paidByFilter.length === 0
                            ? "anyone"
                            : paidByFilter.length === 1
                            ? nameById.get(paidByFilter[0]) || "1 person"
                            : `${paidByFilter.length} people`}
                        </span>
                        <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-2 pb-1 border-b">
                          <Label className="text-sm font-medium">Paid by</Label>
                          {paidByFilter.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPaidByFilter([])}>
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {flatmates.map((flatmate) => (
                            <div
                              key={flatmate.id}
                              className="flex items-center space-x-2 px-2 py-1.5 hover:bg-secondary/50 rounded"
                            >
                              <Checkbox
                                id={`table-paidby-${flatmate.id}`}
                                checked={paidByFilter.includes(flatmate.id)}
                                onCheckedChange={(checked) =>
                                  setPaidByFilter(
                                    checked
                                      ? [...paidByFilter, flatmate.id]
                                      : paidByFilter.filter((id) => id !== flatmate.id)
                                  )
                                }
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
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[28rem] divide-y divide-border/70 overflow-y-auto">
                {expenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    nameOf={(id) => nameById.get(id) ?? "Unknown"}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Export & share */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Export & share</CardTitle>
          <p className="text-xs text-muted-foreground">
            Everything below uses the period and filters above.
          </p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ExportButton
            icon={pdfLoading === "summary" ? Loader2 : Download}
            spin={pdfLoading === "summary"}
            title="Summary PDF"
            subtitle="Balances + who pays whom"
            onClick={generateSummaryPDF}
            disabled={pdfLoading === "summary" || balances.length === 0}
          />
          <ExportButton
            icon={pdfLoading === "all-expenses" ? Loader2 : Download}
            spin={pdfLoading === "all-expenses"}
            title="Expenses PDF"
            subtitle="Every expense, line by line"
            onClick={generateAllExpensesPDF}
            disabled={pdfLoading === "all-expenses" || expenses.length === 0}
          />
          <ExportButton
            icon={copiedExpenses ? Check : Copy}
            title={copiedExpenses ? "Copied" : "Copy breakdown"}
            subtitle="Text, grouped by who paid"
            onClick={copyAllExpenses}
            disabled={expenses.length === 0}
          />
          <ExportButton
            icon={sharing ? Loader2 : Share2}
            spin={sharing}
            title="Public link"
            subtitle="Read-only snapshot anyone can open"
            onClick={createShareLink}
            disabled={sharing || balances.length === 0 || !selectedSplitSpace}
          />
        </CardContent>
      </Card>

      {/* All settlements modal */}
      <Dialog open={allSettlementsOpen} onOpenChange={setAllSettlementsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5" />
              Settlement history
            </DialogTitle>
            <DialogDescription>Periods you've marked as settled in this SplitSpace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {savedSettlements.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setDateRange({ from: parseDay(s.from_date), to: parseDay(s.to_date) });
                    setAllSettlementsOpen(false);
                  }}
                  title="View this period"
                >
                  <div className="text-sm font-medium">
                    {format(parseDay(s.from_date), "d MMM")} – {format(parseDay(s.to_date), "d MMM yyyy")}
                  </div>
                  {s.note && <div className="text-xs text-muted-foreground mt-1 break-words">{s.note}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    Marked {format(new Date(s.created_at), "d MMM yyyy")} · tap to view
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => setSettlementToDelete(s.id)}
                  aria-label="Delete settlement"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!settlementToDelete}
        onOpenChange={(open) => !open && setSettlementToDelete(null)}
        title="Remove this settlement mark?"
        description="Only the saved date range is removed — no expenses are touched."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (settlementToDelete) await deleteSavedSettlement(settlementToDelete);
        }}
      />

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
              Anyone with this link can view the snapshot. New expenses won't change what they see.
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

const ExportButton = ({
  icon: Icon,
  spin,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
      <Icon className={cn("h-4 w-4", spin && "animate-spin")} />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
    </span>
  </button>
);
