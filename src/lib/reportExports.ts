import { format } from "date-fns";
import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import { parseDay } from "@/lib/format";
import type { ExportExpense, ExportInput } from "@/lib/reportText";
import {
  PDF_COLORS,
  accentTableStyles,
  createPdfDoc,
  drawBody,
  drawPdfFooter,
  drawPdfHeader,
  drawSectionTitle,
  pdfAmount,
  tableStyles,
} from "@/lib/pdfStyle";

/**
 * Settle-up PDFs, moved out of the Reports page and loaded on demand. Content
 * is unchanged apart from timezone-safe dates, "Gets back" as the status label
 * (matching the app) and no "Infinity" for an empty split.
 */

export type { ExportExpense, ExportInput, ExportPerson } from "@/lib/reportText";

const lastTableY = (doc: jsPDF, fallback: number): number =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;

const fileRange = (range: ExportInput["range"]) =>
  `${format(range.from, "yyyy-MM-dd")}_to_${format(range.to, "yyyy-MM-dd")}`;

export const downloadAllExpensesPdf = ({ spaceName, range, people, expenses }: ExportInput) => {
  const doc = createPdfDoc();
  const period = `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;

  let y = drawPdfHeader(doc, {
    title: "Expenses Report",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });

  y = drawBody(doc, `Period: ${period}`, y, { muted: true });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  y = drawBody(doc, `Total: ${pdfAmount(totalExpenses)}  ·  ${expenses.length} expenses`, y, {
    muted: true,
  });
  y += 4;

  const tableData = expenses.map((expense) => {
    const paidBy = people.find((p) => p.id === expense.paid_by);
    const splitBetween = expense.expense_splits
      .map((split) => people.find((p) => p.id === split.flatmate_id)?.name)
      .filter(Boolean)
      .join(", ");
    const count = expense.expense_splits.length;
    return [
      format(parseDay(expense.date), "MMM d, yyyy"),
      expense.title,
      paidBy?.name || "Unknown",
      splitBetween || "Nobody",
      count > 0 ? pdfAmount(expense.amount / count) : "-",
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
  doc.save(`expenses_${fileRange(range)}.pdf`);
};

export const downloadSettlementPdf = ({
  spaceName,
  range,
  expenses,
  balances,
  settlements,
}: ExportInput) => {
  const doc = createPdfDoc();
  const period = `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;

  let y = drawPdfHeader(doc, {
    title: "Settlement Report",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });

  y = drawBody(doc, `Period: ${period}`, y, { muted: true });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
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
    balance.balance > 0.01 ? "Gets back" : balance.balance < -0.01 ? "Owes" : "Settled",
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

    autoTable(doc, {
      ...accentTableStyles({
        startY: cursorY + 2,
        head: [["#", "From", "To", "Amount"]],
        body: settlements.map((s, index) => [`${index + 1}`, s.from, s.to, pdfAmount(s.amount)]),
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

    const byPayer = new Map<string, { name: string; expenses: ExportExpense[]; totalPaid: number }>();
    balances.forEach((b) => byPayer.set(b.id, { name: b.name, expenses: [], totalPaid: b.totalPaid }));
    expenses.forEach((e) => byPayer.get(e.paid_by)?.expenses.push(e));

    byPayer.forEach((userData) => {
      doc.setFillColor(...PDF_COLORS.surfaceAlt);
      doc.rect(14, cursorY, 182, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(`${userData.name}  ·  Total paid ${pdfAmount(userData.totalPaid)}`, 16, cursorY + 6);
      cursorY += 11;

      if (userData.expenses.length > 0) {
        autoTable(doc, {
          ...tableStyles({
            startY: cursorY,
            head: [["Date", "Description", "Amount", "Split"]],
            body: userData.expenses.map((e) => [
              format(parseDay(e.date), "MMM d"),
              e.title,
              pdfAmount(e.amount),
              `${e.expense_splits.length} people`,
            ]),
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
        cursorY = lastTableY(doc, cursorY + 12) + 6;
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
  doc.save(`summary_${fileRange(range)}.pdf`);
};
