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
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EmailReportDialog from "@/components/EmailReportDialog";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";

interface Flatmate {
  id: string;
  name: string;
  email: string | null;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
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
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [pdfLoading, setPdfLoading] = useState<
    "summary" | "all-expenses" | null
  >(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [copiedExpenses, setCopiedExpenses] = useState(false);

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
          expense_splits (
            flatmate_id
          )
        `
        )
        .gte("date", dateRange.from.toISOString().split("T")[0])
        .lte("date", dateRange.to.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;

      setFlatmates(flatmatesData || []);
      setExpenses(expensesData || []);
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
        .gte("date", dateRange.from.toISOString().split("T")[0])
        .lte("date", dateRange.to.toISOString().split("T")[0])
        .order("date", { ascending: false });

      const { data: expensesData, error: expensesError } =
        await expensesQuery.or(
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
              expense_splits (
                flatmate_id
              )
            `
            )
            .gte("date", dateRange.from.toISOString().split("T")[0])
            .lte("date", dateRange.to.toISOString().split("T")[0])
            .order("date", { ascending: false });
          if (error) throw error;
          setExpenses(data || []);
        } else {
          throw expensesError;
        }
      } else {
        setExpenses(expensesData || []);
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

  useEffect(() => {
    if (flatmates.length > 0 && expenses.length > 0) {
      calculateBalances();
    }
  }, [flatmates, expenses]);

  const calculateBalances = () => {
    const balanceMap = new Map<string, Balance>();

    // Initialize balances
    flatmates.forEach((flatmate) => {
      balanceMap.set(flatmate.id, {
        id: flatmate.id,
        name: flatmate.name,
        totalPaid: 0,
        totalOwed: 0,
        balance: 0,
      });
    });

    // Calculate total paid and owed
    expenses.forEach((expense) => {
      const paidByBalance = balanceMap.get(expense.paid_by);
      if (paidByBalance) {
        paidByBalance.totalPaid += expense.amount;
      }

      // Calculate split amount per person
      const splitAmount = expense.amount / expense.expense_splits.length;

      expense.expense_splits.forEach((split) => {
        const owedBalance = balanceMap.get(split.flatmate_id);
        if (owedBalance) {
          owedBalance.totalOwed += splitAmount;
        }
      });
    });

    // Calculate net balance
    balanceMap.forEach((balance) => {
      balance.balance = balance.totalPaid - balance.totalOwed;
    });

    const calculatedBalances = Array.from(balanceMap.values());
    setBalances(calculatedBalances);

    // Calculate settlements
    calculateSettlements(calculatedBalances);
  };

  const calculateSettlements = (balances: Balance[]) => {
    const settlements: Settlement[] = [];
    const balancesCopy = [...balances].sort((a, b) => b.balance - a.balance);

    let i = 0;
    let j = balancesCopy.length - 1;

    while (i < j) {
      const debtor = balancesCopy[j];
      const creditor = balancesCopy[i];

      if (
        Math.abs(debtor.balance) < 0.01 &&
        Math.abs(creditor.balance) < 0.01
      ) {
        break;
      }

      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

      if (amount > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: amount,
        });

        debtor.balance += amount;
        creditor.balance -= amount;
      }

      if (Math.abs(debtor.balance) < 0.01) {
        j--;
      }
      if (creditor.balance < 0.01) {
        i++;
      }
    }

    setSettlements(settlements);
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
      doc.text("FLATSHARE EXPENSES REPORT", 14, 20);

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
      doc.text("Generated by FlatShare - Expense Management System", 14, 290);
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
      doc.text("FLATSHARE SETTLEMENT REPORT", 14, 20);

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
          "Generated by FlatShare - Expense Management System",
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
        doc.text("Generated by FlatShare - Expense Management System", 14, 290);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          {selectedSplitSpace && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              <span className="hidden sm:inline">SplitSpace: </span>
              {selectedSplitSpace.name}
            </p>
          )}
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
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
                    date && setDateRange((prev) => ({ ...prev, from: date }))
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
                    date && setDateRange((prev) => ({ ...prev, to: date }))
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

      {/* Reports */}
      <div className="grid gap-6 md:grid-cols-2">
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
      </div>

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
