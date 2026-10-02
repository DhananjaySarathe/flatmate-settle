import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
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
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { PeriodPicker } from "@/components/PeriodPicker";
import { PersonAvatar } from "@/components/PersonAvatar";
import { ExpenseRow } from "@/components/ExpenseRow";
import { useExpenseComposer } from "@/contexts/expense-composer";
import {
  EPSILON,
  formatDay,
  formatMoney,
  formatRange,
  monthRanges,
  parseDay,
  plural,
  sameRange,
  type DayRange,
} from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const location = useLocation();
  const navigate = useNavigate();
  // Home's "Settle up" button hands over the open period in navigation state.
  const [handoffRange] = useState(() => {
    const range = (location.state as { range?: { from: string; to: string } } | null)?.range;
    return range ? { from: new Date(range.from), to: new Date(range.to) } : undefined;
  });
  const {
    dateRange,
    peopleFilters,
    categoryFilters,
    setDateRange,
    setPeopleFilters,
    setCategoryFilters,
    resetFilters,
  } = useReportFilters({ initialDateRange: handoffRange });
  const [pdfLoading, setPdfLoading] = useState<
    "summary" | "all-expenses" | null
  >(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [copiedExpenses, setCopiedExpenses] = useState(false);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  const { openComposer, dataVersion } = useExpenseComposer();
  const [confirmDeleteSettlement, setConfirmDeleteSettlement] = useState<SavedSettlement | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  // Drop the hand-off from history so a reload keeps whatever range is chosen next.
  useEffect(() => {
    if (handoffRange) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [allExpenses, peopleFilters, categoryFilters, sortBy]);

  useEffect(() => {
    // Recompute on every change — including an empty period, which must not
    // keep showing the previous period's balances.
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
    if (expenses.length === 0) {
      toast.error("Nothing to share — no expenses in this period");
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
        text += `  Date: ${format(parseDay(expense.date), "MMM dd, yyyy")}\n`;
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
          format(parseDay(expense.date), "MMM d, yyyy"),
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
              format(parseDay(e.date), "MMM d"),
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

  // ---- Derived view state -------------------------------------------------

  const names = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);
  const idByName = useMemo(() => new Map(flatmates.map((f) => [f.name, f.id])), [flatmates]);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalToMove = settlements.reduce((sum, s) => sum + s.amount, 0);

  const activeFilterCount =
    peopleFilters.exactMatch.length +
    peopleFilters.anyMatch.length +
    peopleFilters.exclude.length +
    peopleFilters.paidBy.length +
    categoryFilters.include.length +
    categoryFilters.exclude.length;

  const today = startOfDay(new Date());
  const latestSettlement = savedSettlements.reduce<SavedSettlement | null>(
    (latest, s) => (!latest || s.to_date > latest.to_date ? s : latest),
    null
  );
  const { thisMonth, lastMonth } = monthRanges(today);
  const presets: { key: string; label: string; range: DayRange }[] = [];
  if (latestSettlement) {
    const from = addDays(parseDay(latestSettlement.to_date), 1);
    presets.push({ key: "since", label: "Since last settle-up", range: { from, to: from > today ? from : today } });
  }
  presets.push({ key: "this-month", label: "This month", range: thisMonth });
  presets.push({ key: "last-month", label: "Last month", range: lastMonth });
  const activePreset = presets.find((p) => sameRange(p.range, dateRange))?.key;

  const filterSummary = (() => {
    const parts: string[] = [];
    const who = (ids: string[]) => ids.map((id) => names.get(id) ?? "?").join(", ");
    if (peopleFilters.paidBy.length) parts.push(`paid by ${who(peopleFilters.paidBy)}`);
    if (peopleFilters.exactMatch.length) parts.push(`shared by all of ${who(peopleFilters.exactMatch)}`);
    if (peopleFilters.anyMatch.length) parts.push(`shared by any of ${who(peopleFilters.anyMatch)}`);
    if (peopleFilters.exclude.length) parts.push(`leaving out ${who(peopleFilters.exclude)}`);
    const cat = (ids: string[]) => ids.map((id) => categories.find((c) => c.id === id)?.name ?? "?").join(", ");
    if (categoryFilters.include.length) parts.push(`only ${cat(categoryFilters.include)}`);
    if (categoryFilters.exclude.length) parts.push(`hiding ${cat(categoryFilters.exclude)}`);
    return parts.join(" · ");
  })();

  const clearAllFilters = () => {
    setPeopleFilters({ exactMatch: [], anyMatch: [], exclude: [], paidBy: [] });
    setCategoryFilters({ include: [], exclude: [] });
  };

  // Allow page to work even if SplitSpaces feature isn't fully set up
  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div>
        <PageHeader title="Settle up" />
        <Panel>
          <p className="py-2 text-sm text-muted-foreground">Pick a space from the switcher to see balances.</p>
        </Panel>
      </div>
    );
  }

  const visibleExpenses = showAllExpenses ? expenses : expenses.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Settle up"
        description={
          <>
            {selectedSplitSpace ? `${selectedSplitSpace.name} · ` : ""}
            {formatRange(dateRange.from, dateRange.to)}
          </>
        }
      />

      {/* Period + filters */}
      <div className="mb-5 space-y-3">
        <PeriodPicker
          chips={presets.map((p) => ({
            key: p.key,
            label: p.label,
            active: activePreset === p.key,
            onSelect: () => setDateRange(p.range),
          }))}
          range={dateRange}
          onCustomRange={setDateRange}
          customActive={!activePreset}
          trailing={
            <>
              {flatmates.length > 0 && (
                <Dialog open={filtersModalOpen} onOpenChange={setFiltersModalOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeFilterCount > 0
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
                      )}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="money rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Filter this period</DialogTitle>
                      <DialogDescription>
                        Balances and payments are worked out from the expenses that match. Filters are saved
                        and also apply on Analytics.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2 space-y-6">
                      <PeopleFilters flatmates={flatmates} value={peopleFilters} onFiltersChange={setPeopleFilters} />
                      <Separator />
                      <CategoryFilterSection
                        categories={categories}
                        categoryFilters={categoryFilters}
                        setCategoryFilters={setCategoryFilters}
                      />
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                      <Button variant="outline" onClick={clearAllFilters} disabled={activeFilterCount === 0}>
                        <X />
                        Clear filters
                      </Button>
                      <Button onClick={() => setFiltersModalOpen(false)}>
                        Show {plural(expenses.length, "expense")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          }
        />

        {activeFilterCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <Filter className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">Filtered:</span>{" "}
              <span className="text-muted-foreground">{filterSummary}</span>
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="shrink-0 font-medium text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <Panel className="xl:col-span-3" title="Who pays whom">
            <SkeletonRows rows={3} />
          </Panel>
          <Panel className="xl:col-span-2" title="Balances">
            <SkeletonRows rows={4} />
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-5 xl:items-start">
          {/* Below xl the column wrappers dissolve so panels stack in reading order. */}
          <div className="contents xl:col-span-3 xl:block xl:space-y-5">
            {/* The answer */}
            <Panel
              className="order-1"
              title="Who pays whom"
              description={
                expenses.length > 0
                  ? `${plural(expenses.length, "expense")} · ${formatMoney(totalSpent, { compact: true })} spent`
                  : undefined
              }
            >
              {expenses.length === 0 ? (
                <div className="py-2">
                  <p className="font-medium">No expenses in this period</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeFilterCount > 0
                      ? "Nothing matches the filters for these dates. Try clearing them."
                      : "Pick another period above, or add an expense dated in this range."}
                  </p>
                </div>
              ) : settlements.length === 0 ? (
                <div className="flex items-start gap-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
                  <div>
                    <p className="font-medium">Everyone's even</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      No money needs to change hands for this period.
                    </p>
                  </div>
                </div>
              ) : (
                <ol className="divide-y divide-border/70">
                  {settlements.map((t, i) => (
                    <li key={`${t.from}-${t.to}-${i}`} className="flex items-center gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <PersonAvatar name={t.from} seed={idByName.get(t.from)} />
                          <span className="truncate font-medium">{t.from}</span>
                        </span>
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          pays
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <PersonAvatar name={t.to} seed={idByName.get(t.to)} />
                          <span className="truncate font-medium">{t.to}</span>
                        </span>
                      </div>
                      <span className="money shrink-0 text-base font-semibold">{formatMoney(t.amount)}</span>
                    </li>
                  ))}
                </ol>
              )}

              {expenses.length > 0 && (
                <div className="mt-3 space-y-3 border-t pt-4">
                  {settlements.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {plural(settlements.length, "payment")} · {formatMoney(totalToMove)} changes hands in total.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {selectedSplitSpace && (
                      <Button onClick={() => setMarkSettlementOpen(true)} className="sm:order-first">
                        <CheckCircle2 />
                        Mark as settled
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={copySettlementSummary}
                      disabled={settlements.length === 0}
                    >
                      {copiedSettlement ? <Check /> : <Copy />}
                      {copiedSettlement ? "Copied" : "Copy summary"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={createShareLink}
                      disabled={sharing || !selectedSplitSpace}
                    >
                      {sharing ? <Loader2 className="animate-spin" /> : <Share2 />}
                      {sharing ? "Creating link" : "Share link"}
                    </Button>
                  </div>
                </div>
              )}
            </Panel>

            {/* Supporting detail */}
            {expenses.length > 0 && (
              <Panel
                className="order-3"
                title="Expenses in this period"
                actions={
                  <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Sort expenses">
                      <ArrowUpDown className="mr-1 h-3 w-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="date-desc">Newest first</SelectItem>
                      <SelectItem value="date-asc">Oldest first</SelectItem>
                      <SelectItem value="amount-desc">Highest amount</SelectItem>
                      <SelectItem value="amount-asc">Lowest amount</SelectItem>
                      <SelectItem value="title-asc">Title A–Z</SelectItem>
                      <SelectItem value="title-desc">Title Z–A</SelectItem>
                    </SelectContent>
                  </Select>
                }
                bodyClassName="pt-1"
              >
                <div className="divide-y divide-border/70">
                  {visibleExpenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      names={names}
                      peopleCount={flatmates.length}
                      onSelect={() => openComposer(expense)}
                    />
                  ))}
                </div>
                {expenses.length > visibleExpenses.length && (
                  <Button variant="ghost" className="mt-2 w-full text-primary" onClick={() => setShowAllExpenses(true)}>
                    Show all {expenses.length}
                    <ChevronDown />
                  </Button>
                )}
              </Panel>
            )}
          </div>

          <div className="contents xl:col-span-2 xl:block xl:space-y-5">
            {expenses.length > 0 && (
              <Panel
                className="order-2"
                title="Balances"
                description="Paid minus their share of each expense"
                bodyClassName="pt-1"
              >
                <ul className="divide-y divide-border/70">
                  {balances.map((b) => {
                    const state = Math.abs(b.balance) < EPSILON ? "even" : b.balance > 0 ? "gets" : "owes";
                    return (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <PersonAvatar name={b.name} seed={b.id} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b.name}</p>
                          <p className="money text-xs text-muted-foreground">
                            Paid {formatMoney(b.totalPaid)} · share {formatMoney(b.totalOwed)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {state === "even" ? (
                            <span className="text-sm text-muted-foreground">Even</span>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  "block text-[11px] font-medium",
                                  state === "gets" ? "text-positive" : "text-negative"
                                )}
                              >
                                {state === "gets" ? "gets back" : "owes"}
                              </span>
                              <span
                                className={cn(
                                  "money block text-sm font-semibold",
                                  state === "gets" ? "text-positive" : "text-negative"
                                )}
                              >
                                {formatMoney(Math.abs(b.balance))}
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            <Panel className="order-4" title="Export" description="Uses the period and filters above">
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={generateSummaryPDF}
                  disabled={pdfLoading === "summary" || expenses.length === 0}
                >
                  {pdfLoading === "summary" ? <Loader2 className="animate-spin" /> : <Download />}
                  Settlement report
                  <span className="ml-auto text-xs text-muted-foreground">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={generateAllExpensesPDF}
                  disabled={pdfLoading === "all-expenses" || expenses.length === 0}
                >
                  {pdfLoading === "all-expenses" ? <Loader2 className="animate-spin" /> : <Download />}
                  Expense list
                  <span className="ml-auto text-xs text-muted-foreground">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={copyAllExpenses}
                  disabled={expenses.length === 0}
                >
                  {copiedExpenses ? <Check /> : <Copy />}
                  {copiedExpenses ? "Copied" : "Copy breakdown by person"}
                  <span className="ml-auto text-xs text-muted-foreground">Text</span>
                </Button>
              </div>
            </Panel>

            {selectedSplitSpace && (
              <Panel
                className="order-5"
                title="Past settle-ups"
                description={
                  savedSettlements.length === 0
                    ? "Periods you mark as settled show up here."
                    : "Tap a period to load it"
                }
                bodyClassName={savedSettlements.length === 0 ? "pb-1 pt-0" : "pt-1"}
              >
                {savedSettlements.length > 0 && (
                  <ul className="divide-y divide-border/70">
                    {(allSettlementsOpen ? savedSettlements : savedSettlements.slice(0, 4)).map((s) => {
                      const loaded =
                        isSameDay(parseDay(s.from_date), dateRange.from) &&
                        isSameDay(parseDay(s.to_date), dateRange.to);
                      return (
                        <li key={s.id} className="flex items-center gap-1 py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDateRange({ from: parseDay(s.from_date), to: parseDay(s.to_date) })
                            }
                            className={cn(
                              "-ml-2 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              loaded && "bg-secondary"
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <Bookmark className={cn("h-3.5 w-3.5 shrink-0", loaded ? "text-primary" : "text-muted-foreground")} />
                              {formatRange(parseDay(s.from_date), parseDay(s.to_date))}
                            </span>
                            <span className="mt-0.5 block truncate pl-[1.375rem] text-xs text-muted-foreground">
                              {s.note ? `${s.note} · ` : ""}marked {formatDay(s.created_at.slice(0, 10), "MMM d")}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-negative"
                            onClick={() => setConfirmDeleteSettlement(s)}
                            aria-label={`Remove settle-up ${formatRange(parseDay(s.from_date), parseDay(s.to_date))}`}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {savedSettlements.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full text-primary"
                    onClick={() => setAllSettlementsOpen((v) => !v)}
                  >
                    {allSettlementsOpen ? "Show fewer" : `Show all ${savedSettlements.length}`}
                  </Button>
                )}
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* Mark as settled */}
      <Dialog
        open={markSettlementOpen}
        onOpenChange={(open) => {
          setMarkSettlementOpen(open);
          if (!open) setSettlementNote("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {formatRange(dateRange.from, dateRange.to)} as settled?</DialogTitle>
            <DialogDescription>
              Do this once the payments above have been made. Home then only counts expenses after{" "}
              {format(dateRange.to, "MMM d")}, so the next round starts fresh. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="settlement-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="settlement-note"
              placeholder="e.g. Paid over UPI, Kabir still owes ₹200"
              value={settlementNote}
              onChange={(e) => setSettlementNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMarkSettlementOpen(false)} disabled={savingSettlement}>
              Cancel
            </Button>
            <Button onClick={saveSettlement} disabled={savingSettlement}>
              {savingSettlement ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Mark as settled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove a past settle-up */}
      <AlertDialog
        open={!!confirmDeleteSettlement}
        onOpenChange={(open) => !open && setConfirmDeleteSettlement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this settle-up?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteSettlement &&
                `${formatRange(
                  parseDay(confirmDeleteSettlement.from_date),
                  parseDay(confirmDeleteSettlement.to_date)
                )} will no longer count as settled, so its expenses go back into the open balance on Home. Expenses themselves aren't touched.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteSettlement) deleteSavedSettlement(confirmDeleteSettlement.id);
                setConfirmDeleteSettlement(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <LinkIcon className="h-5 w-5" />
              Public link ready
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can see this period's balances, payments and expenses. It's a snapshot:
              later changes won't show up.
            </DialogDescription>
          </DialogHeader>
          {shareUrl && (
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copyShareUrl} variant="outline">
                {shareCopied ? <Check /> : <Copy />}
                {shareCopied ? "Copied" : "Copy"}
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
