import { format } from "date-fns";
import type { Settlement } from "@/lib/settlement";
import type { Expense, Flatmate } from "@/lib/db";
import { parseDateOnly } from "@/lib/format";

interface Period {
  from: Date;
  to: Date;
}

/** Plain-text settle-up plan for pasting into chat. Format kept from the original Reports page. */
export const settlementSummaryText = (settlements: Settlement[], period: Period, spaceName?: string) => {
  let text = `SETTLEMENT SUMMARY\n`;
  text += `Period: ${format(period.from, "MMM dd, yyyy")} - ${format(period.to, "MMM dd, yyyy")}\n\n`;
  if (spaceName) text += `SplitSpace: ${spaceName}\n\n`;
  text += `Settlements:\n`;
  text += `${"=".repeat(50)}\n`;
  settlements.forEach((s, index) => {
    text += `${index + 1}. ${s.from} owes ${s.to}: ₹${s.amount.toFixed(2)}\n`;
  });
  text += `\n${"=".repeat(50)}\n`;
  text += `Total Settlements: ${settlements.length} transaction${settlements.length !== 1 ? "s" : ""}\n`;
  return text;
};

/** Every expense grouped by who paid. Format kept from the original Reports page. */
export const expenseBreakdownText = (
  expenses: Expense[],
  flatmates: Flatmate[],
  period: Period,
  spaceName?: string
) => {
  let text = `ALL EXPENSES - USER WISE\n`;
  text += `Period: ${format(period.from, "MMM dd, yyyy")} - ${format(period.to, "MMM dd, yyyy")}\n\n`;
  if (spaceName) text += `SplitSpace: ${spaceName}\n\n`;

  flatmates.forEach((flatmate) => {
    const paid = expenses.filter((e) => e.paid_by === flatmate.id);
    if (paid.length === 0) return;

    text += `${"=".repeat(50)}\n`;
    text += `${flatmate.name.toUpperCase()}\n`;
    text += `${"=".repeat(50)}\n\n`;

    let userTotal = 0;
    paid.forEach((expense) => {
      const splitAmount = expense.amount / expense.expense_splits.length;
      const splitWith = expense.expense_splits
        .map((split) => flatmates.find((f) => f.id === split.flatmate_id)?.name || "Unknown")
        .join(", ");

      text += `• ${expense.title}\n`;
      text += `  Date: ${format(parseDateOnly(expense.date), "MMM dd, yyyy")}\n`;
      text += `  Amount: ₹${expense.amount.toFixed(2)}\n`;
      text += `  Split with: ${splitWith}\n`;
      text += `  Per person: ₹${splitAmount.toFixed(2)}\n`;
      text += `\n`;
      userTotal += expense.amount;
    });

    text += `Total paid by ${flatmate.name}: ₹${userTotal.toFixed(2)}\n\n`;
  });

  text += `${"=".repeat(50)}\n`;
  text += `Grand Total: ₹${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}\n`;
  text += `Total Expenses: ${expenses.length}\n`;
  return text;
};

/** Clipboard write that reports success instead of throwing. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
