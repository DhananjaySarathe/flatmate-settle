import { format } from "date-fns";
import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import { parseDay } from "@/lib/format";
import {
  accentTableStyles,
  createPdfDoc,
  drawBody,
  drawPdfFooter,
  drawPdfHeader,
  drawSectionTitle,
  pdfAmount,
  tableStyles,
} from "@/lib/pdfStyle";
import type {
  CategoryTotal,
  DayTotal,
  LeaderboardData,
  PersonCost,
} from "@/components/insights/insightMath";

/**
 * Insights PDFs (Spending, Cost per person, Leaderboard). Moved out of the
 * pages with the same titles, sections, file names and "Rs." amounts. The only
 * content changes: the Analytics "Fairness score" line is gone, dates are
 * parsed timezone-safely, and the Leaderboard tables use correctly sorted data.
 * Each builder saves the file and returns its name.
 */

const lastTableY = (doc: jsPDF, fallback: number): number =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;

// ---------------------------------------------------------------- Spending

export interface AnalyticsPdfInput {
  spaceName?: string;
  range: { from: Date; to: Date };
  categoryTotals: CategoryTotal[];
  totalExpenses: number;
  mostExpensiveCategory: { name: string; total: number };
  avgPerDay: number;
  avgPerPerson: number;
  topDays: DayTotal[];
}

export const generateAnalyticsSummaryPDF = ({
  spaceName,
  range,
  categoryTotals,
  totalExpenses,
  mostExpensiveCategory,
  avgPerDay,
  avgPerPerson,
  topDays,
}: AnalyticsPdfInput): string => {
  const doc = createPdfDoc();
  const period = `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;

  let y = drawPdfHeader(doc, {
    title: "Analytics Summary",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });
  y = drawBody(doc, `Period: ${period}`, y, { muted: true });
  y += 4;

  y = drawSectionTitle(doc, "Category Breakdown", y);

  const categoryData = categoryTotals
    .filter((cat) => cat.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((cat) => [cat.name, pdfAmount(cat.total), `${cat.percentage.toFixed(1)}%`, cat.count.toString()]);

  autoTable(doc, {
    ...tableStyles({
      startY: y + 2,
      head: [["Category", "Total", "%", "Count"]],
      body: categoryData,
      columnStyles: {
        1: { halign: "right", fontStyle: "bold" },
        2: { halign: "right" },
        3: { halign: "center" },
      },
      didDrawPage: () => drawPdfFooter(doc),
    }),
  });

  const finalY = lastTableY(doc, y);

  let cursorY = drawSectionTitle(doc, "Key Insights", finalY + 14);
  cursorY = drawBody(doc, `Total expenses: ${pdfAmount(totalExpenses)}`, cursorY + 4);
  cursorY = drawBody(
    doc,
    `Most expensive category: ${mostExpensiveCategory.name} (${pdfAmount(mostExpensiveCategory.total)})`,
    cursorY
  );
  cursorY = drawBody(doc, `Average per day: ${pdfAmount(avgPerDay)}`, cursorY);
  cursorY = drawBody(doc, `Average per person: ${pdfAmount(avgPerPerson)}`, cursorY);

  if (topDays.length > 0) {
    cursorY = drawSectionTitle(doc, "Top 5 Most Expensive Days", cursorY + 8);

    const topDaysData = topDays.map((day, idx) => [
      `${idx + 1}`,
      format(parseDay(day.date), "MMM d, yyyy"),
      pdfAmount(day.total),
      day.count.toString(),
    ]);

    autoTable(doc, {
      ...accentTableStyles({
        startY: cursorY + 2,
        head: [["#", "Date", "Total", "Expenses"]],
        body: topDaysData,
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          2: { halign: "right", fontStyle: "bold" },
          3: { halign: "center" },
        },
        didDrawPage: () => drawPdfFooter(doc),
      }),
    });
  }

  drawPdfFooter(doc);

  const fileName = `analytics_${format(range.from, "yyyy-MM-dd")}_to_${format(range.to, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
  return fileName;
};

// ---------------------------------------------------------- Cost per person

export interface CostReportPdfInput {
  spaceName?: string;
  /** "All time" or "MMM d, yyyy – MMM d, yyyy". */
  periodLabel: string;
  personCosts: PersonCost[];
  expenseCount: number;
}

export const generateCostReportPDF = ({
  spaceName,
  periodLabel,
  personCosts,
  expenseCount,
}: CostReportPdfInput): string => {
  const doc = createPdfDoc();
  const totalCost = personCosts.reduce((sum, p) => sum + p.totalCost, 0);

  let y = drawPdfHeader(doc, {
    title: "Cost Report",
    subtitle: spaceName,
    meta: `${periodLabel} · ${format(new Date(), "MMM d, yyyy")}`,
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

  const finalY = lastTableY(doc, y);
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
    `Average per person: ${personCosts.length > 0 ? pdfAmount(totalCost / personCosts.length) : "Rs. 0.00"}`,
    cy
  );
  drawBody(doc, `Total expenses: ${expenseCount}`, cy);

  drawPdfFooter(doc);

  const fileName = `cost_report_${spaceName || "all"}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
  return fileName;
};

// ------------------------------------------------------------- Leaderboard

export const generateLeaderboardPDF = ({
  spaceName,
  data,
}: {
  spaceName?: string;
  data: LeaderboardData;
}): string => {
  const { topPayers, mostGenerous, silentAssassin, bigSpender, milkBhai, fuelKing, foodie } = data;
  const doc = createPdfDoc();

  let y = drawPdfHeader(doc, {
    title: "Leaderboard",
    subtitle: spaceName,
    meta: format(new Date(), "MMM d, yyyy"),
  });

  y = drawSectionTitle(doc, "Top 3 Payers", y);

  const topPayersData = topPayers.map((person, idx) => [
    idx === 0 ? "Gold" : idx === 1 ? "Silver" : "Bronze",
    person.name,
    pdfAmount(person.totalPaid),
    person.expenseCount.toString(),
  ]);

  autoTable(doc, {
    ...accentTableStyles({
      startY: y + 2,
      head: [["Rank", "Name", "Total Paid", "Expenses"]],
      body: topPayersData,
      columnStyles: {
        0: { fontStyle: "bold" },
        2: { halign: "right", fontStyle: "bold" },
        3: { halign: "center" },
      },
      didDrawPage: () => drawPdfFooter(doc),
    }),
  });

  const finalY = lastTableY(doc, y);

  const sectionY = drawSectionTitle(doc, "Fun Stats & Badges", finalY + 14);

  const funStatsData = [
    ["Most Generous", mostGenerous?.name || "N/A", mostGenerous ? pdfAmount(mostGenerous.totalPaid) : "Rs. 0.00"],
    [
      "Silent Assassin",
      silentAssassin?.name || "N/A",
      silentAssassin ? pdfAmount(silentAssassin.totalPaid) : "Rs. 0.00",
    ],
    ["Big Spender", bigSpender?.name || "N/A", bigSpender ? pdfAmount(bigSpender.highestExpense) : "Rs. 0.00"],
    ["Milk Bhai (Groceries)", milkBhai.name, pdfAmount(milkBhai.total)],
    ["Fuel King", fuelKing.name, pdfAmount(fuelKing.total)],
    ["Foodie", foodie.name, pdfAmount(foodie.total)],
  ];

  autoTable(doc, {
    ...tableStyles({
      startY: sectionY + 2,
      head: [["Badge", "Winner", "Amount"]],
      body: funStatsData,
      columnStyles: {
        2: { halign: "right", fontStyle: "bold" },
      },
      didDrawPage: () => drawPdfFooter(doc),
    }),
  });

  drawPdfFooter(doc);

  const fileName = `leaderboard_${spaceName || "default"}.pdf`;
  doc.save(fileName);
  return fileName;
};
