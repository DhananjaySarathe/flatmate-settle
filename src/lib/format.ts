import { format, parseISO } from "date-fns";

/** Money as shown in the app UI. Matches the ₹ + 2 decimals used across Reports/Analytics. */
export const formatMoney = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Expense dates are stored as `yyyy-MM-dd`. `new Date("2025-01-05")` parses as UTC midnight,
 * which shows the previous day in negative-offset timezones; parseISO keeps it local.
 */
export const parseDay = (date: string): Date => parseISO(date);

export const formatDay = (date: string, pattern = "MMM d, yyyy"): string =>
  format(parseDay(date), pattern);

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
