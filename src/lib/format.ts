import { format, isToday, isYesterday, parseISO } from "date-fns";

export const formatMoney = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Expense dates are stored as "yyyy-MM-dd". `new Date("2025-01-05")` parses as
// UTC midnight and can render as the previous day; parseISO keeps it local.
export const parseDateOnly = (date: string) => parseISO(date);

export const relativeDay = (date: string) => {
  const d = parseDateOnly(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
};

export const errorText = (error: unknown) =>
  (error as { message?: string })?.message || "Something went wrong. Try again.";
