import { format } from "date-fns";
import type { Balance, Settlement } from "@/lib/settlement";
import { formatMoney, formatRange, parseDay, pluralize } from "@/lib/format";

/**
 * Clipboard text for Settle up and Home. Kept apart from the PDF builders so
 * jsPDF only loads when someone actually exports a PDF.
 */

export interface ExportExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  expense_splits: { flatmate_id: string }[];
}

export interface ExportPerson {
  id: string;
  name: string;
}

export interface ExportInput {
  spaceName?: string;
  range: { from: Date; to: Date };
  people: ExportPerson[];
  expenses: ExportExpense[];
  balances: Balance[];
  settlements: Settlement[];
}

/** Plain text for a group chat: "Ben pays Asha ₹450". */
export const buildSettlementSummaryText = ({ spaceName, range, settlements }: ExportInput) => {
  const period = formatRange(range.from, range.to);
  if (settlements.length === 0) {
    return `${spaceName ? `${spaceName} · ` : ""}Everyone's settled up for ${period}.`;
  }
  const total = settlements.reduce((sum, s) => sum + s.amount, 0);
  const lines = settlements.map((s) => `${s.from} pays ${s.to} ${formatMoney(s.amount)}`);
  return [
    `${spaceName ? `${spaceName} · ` : ""}settle up`,
    period,
    "",
    ...lines,
    "",
    `${pluralize(settlements.length, "payment")} · ${formatMoney(total)} in total`,
  ].join("\n");
};

/** Every expense in the period, grouped by who paid. */
export const buildAllExpensesText = ({ spaceName, range, people, expenses }: ExportInput) => {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || "Unknown";

  let text = `ALL EXPENSES BY WHO PAID\n`;
  text += `${formatRange(range.from, range.to)}\n`;
  if (spaceName) text += `Group: ${spaceName}\n`;
  text += `\n`;

  people.forEach((person) => {
    const paid = expenses.filter((e) => e.paid_by === person.id);
    if (paid.length === 0) return;

    text += `${"=".repeat(40)}\n`;
    text += `${person.name.toUpperCase()}\n`;
    text += `${"=".repeat(40)}\n\n`;

    let userTotal = 0;
    paid.forEach((expense) => {
      const count = expense.expense_splits.length;
      const splitWith = count > 0 ? expense.expense_splits.map((s) => nameOf(s.flatmate_id)).join(", ") : "Nobody in split";
      text += `• ${expense.title}\n`;
      text += `  Date: ${format(parseDay(expense.date), "d MMM yyyy")}\n`;
      text += `  Amount: ${formatMoney(expense.amount)}\n`;
      text += `  Split with: ${splitWith}\n`;
      if (count > 0) text += `  Per person: ${formatMoney(expense.amount / count)}\n`;
      text += `\n`;
      userTotal += expense.amount;
    });

    text += `Total paid by ${person.name}: ${formatMoney(userTotal)}\n\n`;
  });

  text += `${"=".repeat(40)}\n`;
  text += `Grand total: ${formatMoney(expenses.reduce((sum, e) => sum + e.amount, 0))}\n`;
  text += `Expenses: ${expenses.length}\n`;
  return text;
};
