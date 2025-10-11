import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Loader2,
  CalendarIcon,
  ArrowRight,
  Mail,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EmailReportDialog from "@/components/EmailReportDialog";

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
  flatmates: {
    name: string;
  };
  expense_splits: {
    flatmate_id: string;
  }[];
}

interface FlatmateBalance {
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

const Reports = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });
  const [balances, setBalances] = useState<FlatmateBalance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pdfLoading, setPdfLoading] = useState<
    "summary" | "all-expenses" | null
  >(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      const [flatmatesRes, expensesRes] = await Promise.all([
        supabase.from("flatmates").select("id, name, email").order("name"),
        supabase
          .from("expenses")
          .select(
            `
            *,
            flatmates!expenses_paid_by_fkey (name),
            expense_splits (flatmate_id)
          `
          )
          .gte("date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("date", format(dateRange.to, "yyyy-MM-dd"))
          .order("date", { ascending: false }),
      ]);

      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setExpenses(expensesRes.data || []);

      calculateBalances(flatmatesRes.data || [], expensesRes.data || []);
    } catch (error: any) {
      toast.error("Error fetching data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (
    flatmatesList: Flatmate[],
    expensesList: Expense[]
  ) => {
    const balanceMap = new Map<string, FlatmateBalance>();

    // Initialize balances
    flatmatesList.forEach((flatmate) => {
      balanceMap.set(flatmate.id, {
        id: flatmate.id,
        name: flatmate.name,
        totalPaid: 0,
        totalOwed: 0,
        balance: 0,
      });
    });

    // Calculate paid and owed amounts
    expensesList.forEach((expense) => {
      const payer = balanceMap.get(expense.paid_by);
      if (payer) {
        payer.totalPaid += expense.amount;
      }

      const splitCount = expense.expense_splits.length;
      const sharePerPerson = expense.amount / splitCount;

      expense.expense_splits.forEach((split) => {
        const member = balanceMap.get(split.flatmate_id);
        if (member) {
          member.totalOwed += sharePerPerson;
        }
      });
    });

    // Calculate net balances
    const balancesList: FlatmateBalance[] = [];
    balanceMap.forEach((balance) => {
      balance.balance = balance.totalPaid - balance.totalOwed;
      balancesList.push(balance);
    });

    setBalances(balancesList.sort((a, b) => b.balance - a.balance));
    calculateSettlements(balancesList);
  };

  const calculateSettlements = (balancesList: FlatmateBalance[]) => {
    const debtors = balancesList
      .filter((b) => b.balance < 0)
      .map((b) => ({ ...b }));
    const creditors = balancesList
      .filter((b) => b.balance > 0)
      .map((b) => ({ ...b }));
    const settlements: Settlement[] = [];

    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];

      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });

      debtor.balance += amount;
      creditor.balance -= amount;

      if (Math.abs(debtor.balance) < 0.01) debtors.shift();
      if (Math.abs(creditor.balance) < 0.01) creditors.shift();
    }

    setSettlements(settlements);
  };

  const generateAllExpensesPDF = async () => {
    setPdfLoading("all-expenses");
    try {
      const doc = new jsPDF();

      // Professional Header with gradient-like effect
      doc.setFillColor(168, 85, 247);
      doc.rect(0, 0, 210, 35, "F");

      // Add subtle border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 35);

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("FlatShare Expenses Report", 14, 22);

      // Reset font and add subtitle
      doc.setFont(undefined, "normal");
      doc.setFontSize(12);
      doc.text("Complete Expense Breakdown", 14, 28);

      // Date range and generation info in a clean box
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 40, 182, 20, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(14, 40, 182, 20);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
          dateRange.to,
          "MMM dd, yyyy"
        )}`,
        16,
        48
      );
      doc.text(
        `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        16,
        53
      );
      doc.text(`Total Expenses: ${expenses.length}`, 16, 58);

      // Expenses table with enhanced data
      const tableData = expenses.map((expense) => {
        const sharePerPerson = expense.amount / expense.expense_splits.length;
        return [
          format(new Date(expense.date), "MMM dd, yyyy"),
          expense.title,
          expense.flatmates.name,
          `${expense.expense_splits.length} people`,
          `$${sharePerPerson.toFixed(2)} each`,
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
        theme: "striped",
        headStyles: {
          fillColor: [168, 85, 247],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
          cellPadding: 4,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
        },
        columnStyles: {
          4: { halign: "right" },
          5: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 60;

      // Enhanced Summary Section
      doc.setFillColor(240, 240, 240);
      doc.rect(14, finalY + 10, 182, 25, "F");

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(undefined, "bold");
      doc.text("Summary", 14, finalY + 20);

      const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const avgPerExpense =
        expenses.length > 0 ? totalAmount / expenses.length : 0;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Total Expenses: $${totalAmount.toFixed(2)}`, 14, finalY + 28);
      doc.text(`Number of Expenses: ${expenses.length}`, 14, finalY + 34);
      doc.text(
        `Average per Expense: $${avgPerExpense.toFixed(2)}`,
        14,
        finalY + 40
      );

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Generated by FlatShare - Expense Management System", 14, 290);
      doc.text(`Page 1 of 1`, 180, 290);

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

      // Professional Header
      doc.setFillColor(168, 85, 247);
      doc.rect(0, 0, 210, 30, "F");

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("Settlement Summary Report", 14, 20);

      // Reset font
      doc.setFont(undefined, "normal");

      // Date range and generation info
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
          dateRange.to,
          "MMM dd, yyyy"
        )}`,
        14,
        38
      );
      doc.text(
        `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`,
        14,
        44
      );

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 14, 50);

      // Balance Summary Section
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(undefined, "bold");
      doc.text("Balance Summary", 14, 65);

      // User-wise balance table with enhanced formatting
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
          fillColor: [168, 85, 247],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "center" },
        },
      });

      const finalY1 = (doc as any).lastAutoTable?.finalY || 72;

      // Settlement Instructions Section
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(undefined, "bold");
      doc.text("Settlement Instructions", 14, finalY1 + 15);

      if (settlements.length > 0) {
        const settlementData = settlements.map((s, index) => [
          `${index + 1}.`,
          s.from,
          "→",
          s.to,
          `$${s.amount.toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: finalY1 + 22,
          head: [["#", "From", "", "To", "Amount"]],
          body: settlementData,
          theme: "grid",
          headStyles: {
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          columnStyles: {
            1: { halign: "center" },
            2: { halign: "center" },
            4: { halign: "right", fontStyle: "bold" },
          },
        });

        const finalY2 = (doc as any).lastAutoTable?.finalY || finalY1 + 22;

        // Settlement Summary Box
        doc.setFillColor(34, 197, 94, 0.1);
        doc.rect(14, finalY2 + 10, 182, 20, "F");

        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        doc.setFont(undefined, "bold");
        doc.text("Settlement Complete!", 14, finalY2 + 18);

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont(undefined, "normal");
        doc.text(
          `Total settlements: ${settlements.length} transactions`,
          14,
          finalY2 + 25
        );
        const totalSettlements = settlements.reduce(
          (sum, s) => sum + s.amount,
          0
        );
        doc.text(
          `Total amount to be transferred: $${totalSettlements.toFixed(2)}`,
          14,
          finalY2 + 31
        );
      } else {
        // All settled message
        doc.setFillColor(34, 197, 94, 0.1);
        doc.rect(14, finalY1 + 22, 182, 15, "F");

        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        doc.setFont(undefined, "bold");
        doc.text("All Settled Up! 🎉", 14, finalY1 + 32);

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont(undefined, "normal");
        doc.text(
          "No money needs to be transferred between flatmates.",
          14,
          finalY1 + 38
        );
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Generated by FlatShare - Expense Management System", 14, 290);
      doc.text(`Page 1 of 1`, 180, 290);

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
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast.error(`Failed to send emails: ${error.message || "Unknown error"}`);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold gradient-text mb-2">Reports</h1>
        <p className="text-muted-foreground">
          View summaries and download expense reports
        </p>
      </div>

      {/* Date Range Selector */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary/50",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from
                      ? format(dateRange.from, "PPP")
                      : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 glass-card pointer-events-auto"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      date && setDateRange({ ...dateRange, from: date })
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary/50",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to
                      ? format(dateRange.to, "PPP")
                      : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 glass-card pointer-events-auto"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      date && setDateRange({ ...dateRange, to: date })
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Summary */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Balance Summary</span>
            <div className="flex gap-2">
              <Button
                onClick={() => setEmailDialogOpen(true)}
                variant="outline"
                size="sm"
                disabled={balances.length === 0}
                className="border-primary/30 hover:bg-primary/10"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send via Email
              </Button>
              <Button
                onClick={generateSummaryPDF}
                variant="outline"
                size="sm"
                disabled={balances.length === 0 || pdfLoading === "summary"}
                className="border-primary/30 hover:bg-primary/10"
              >
                {pdfLoading === "summary" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No data for selected period
            </p>
          ) : (
            <div className="space-y-3">
              {balances.map((balance, index) => (
                <motion.div
                  key={balance.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-secondary/30 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {balance.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Paid: ${balance.totalPaid.toFixed(2)} • Owes: $
                            {balance.totalOwed.toFixed(2)}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "text-2xl font-bold",
                            balance.balance > 0
                              ? "text-success"
                              : balance.balance < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {balance.balance > 0 ? "+" : ""}$
                          {balance.balance.toFixed(2)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Summary */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Settlement Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {balances.length === 0
                ? "No data for selected period"
                : "All settled up! 🎉"}
            </p>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-gradient-to-r from-success/10 to-success/5 border-success/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">
                            {settlement.from}
                          </span>
                          <ArrowRight className="w-5 h-5 text-success" />
                          <span className="font-semibold">{settlement.to}</span>
                        </div>
                        <span className="text-xl font-bold text-success">
                          ${settlement.amount.toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Expenses Report */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary" />
              All Expenses ({expenses.length})
            </div>
            <Button
              onClick={generateAllExpensesPDF}
              disabled={expenses.length === 0 || pdfLoading === "all-expenses"}
              className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            >
              {pdfLoading === "all-expenses" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No expenses for selected period
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-4">
                Total:{" "}
                <span className="text-primary font-semibold text-lg">
                  $
                  {expenses
                    .reduce((sum, exp) => sum + exp.amount, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Report Dialog */}
      <EmailReportDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        flatmates={flatmates}
        onSendEmail={handleSendEmail}
      />
    </div>
  );
};

export default Reports;
