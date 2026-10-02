import { format } from "date-fns";
import autoTable from "jspdf-autotable";
import type jsPDF from "jspdf";
import type { Balance, Settlement } from "@/lib/settlement";
import type { Expense, Flatmate } from "@/lib/db";
import { parseDateOnly } from "@/lib/format";
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

interface ReportInput {
  expenses: Expense[];
  flatmates: Flatmate[];
  period: { from: Date; to: Date };
  spaceName?: string;
}

const lastTableY = (doc: jsPDF, fallback: number): number =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || fallback;

const periodLabel = ({ from, to }: { from: Date; to: Date }) =>
  `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;

const fileRange = ({ from, to }: { from: Date; to: Date }) =>
  `${format(from, "yyyy-MM-dd")}_to_${format(to, "yyyy-MM-dd")}`;

/** "Expenses Report": every expense in the period. Layout unchanged from the original Reports page. */
export const downloadExpensesPdf = ({ expenses, flatmates, period, spaceName }: ReportInput) => {
  const doc = createPdfDoc();

  let y = drawPdfHeader(doc, {
    title: "Expenses Report",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });

  y = drawBody(doc, `Period: ${periodLabel(period)}`, y, { muted: true });
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
      format(parseDateOnly(expense.date), "MMM d, yyyy"),
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

  const summaryY = lastTableY(doc, y) + 12;

  drawSectionTitle(doc, "Summary", summaryY);
  drawBody(doc, `Total expenses: ${expenses.length}`, summaryY + 8);
  drawBody(doc, `Total amount: ${pdfAmount(totalExpenses)}`, summaryY + 14);
  if (expenses.length > 0) {
    drawBody(doc, `Average per expense: ${pdfAmount(totalExpenses / expenses.length)}`, summaryY + 20);
  }

  drawPdfFooter(doc);
  doc.save(`expenses_${fileRange(period)}.pdf`);
};

/** "Settlement Report": balances, the payment plan and a per-payer breakdown. Layout unchanged. */
export const downloadSettlementPdf = ({
  expenses,
  period,
  spaceName,
  balances,
  settlements,
}: ReportInput & { balances: Balance[]; settlements: Settlement[] }) => {
  const doc = createPdfDoc();

  let y = drawPdfHeader(doc, {
    title: "Settlement Report",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });

  y = drawBody(doc, `Period: ${periodLabel(period)}`, y, { muted: true });
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  y = drawBody(doc, `Total expenses: ${pdfAmount(totalExpenses)}`, y, { muted: true });
  y += 4;

  y = drawSectionTitle(doc, "Balance Summary", y);

  const balanceData = balances.map((balance) => [
    balance.name,
    pdfAmount(balance.totalPaid),
    pdfAmount(balance.totalOwed),
    balance.balance >= 0 ? `+${pdfAmount(balance.balance)}` : `-${pdfAmount(Math.abs(balance.balance))}`,
    balance.balance > 0.01 ? "Is owed" : balance.balance < -0.01 ? "Owes" : "Settled",
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

  const finalY1 = lastTableY(doc, y);

  if (settlements.length > 0) {
    let cursorY = drawSectionTitle(doc, "Settlement Instructions", finalY1 + 12);

    const settlementData = settlements.map((s, index) => [`${index + 1}`, s.from, s.to, pdfAmount(s.amount)]);

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

    const finalY2 = lastTableY(doc, cursorY);
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

    type UserBreak = { name: string; expenses: Expense[]; totalPaid: number };
    const userExpenseMap = new Map<string, UserBreak>();
    balances.forEach((balance) => {
      userExpenseMap.set(balance.id, { name: balance.name, expenses: [], totalPaid: balance.totalPaid });
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
      doc.text(`${userData.name}  ·  Total paid ${pdfAmount(userData.totalPaid)}`, 16, cursorY + 6);
      cursorY += 11;

      if (userData.expenses.length > 0) {
        const userExpenseData = userData.expenses.map((e) => [
          format(parseDateOnly(e.date), "MMM d"),
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

        cursorY = lastTableY(doc, cursorY + 12);
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
  doc.save(`summary_${fileRange(period)}.pdf`);
};
