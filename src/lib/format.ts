import {
  endOfMonth,
  format,
  isSameDay,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";

/**
 * Display helpers shared across pages. Display only — no rounding happens
 * before amounts reach the settlement maths in `lib/settlement.ts`.
 */

const inr2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,234.50 — or ₹1,234 when `whole` is set or the amount has no paise. */
export const formatMoney = (
  amount: number,
  opts: { whole?: boolean; compact?: boolean } = {}
): string => {
  const abs = Math.abs(amount);
  const hasPaise = Math.round(abs * 100) % 100 !== 0;
  const body = opts.whole || (opts.compact && !hasPaise) ? inr0.format(abs) : inr2.format(abs);
  return `${amount < 0 ? "−" : ""}₹${body}`;
};

/**
 * Expense dates are stored as `yyyy-MM-dd`. `new Date("2026-10-02")` parses
 * that as UTC midnight, which renders as the previous day west of UTC — and
 * shifts the date by one on every edit. `parseISO` keeps it a local date.
 */
export const parseDay = (value: string): Date => parseISO(value);

export const toDayString = (date: Date): string => format(date, "yyyy-MM-dd");

export const formatDay = (value: string | Date, pattern = "MMM d, yyyy"): string =>
  format(typeof value === "string" ? parseDay(value) : value, pattern);

/** "Today", "Yesterday", "Mon, Sep 29", or "Sep 29, 2025" for other years. */
export const formatRelativeDay = (value: string | Date): string => {
  const date = typeof value === "string" ? parseDay(value) : value;
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (date.getFullYear() === new Date().getFullYear()) return format(date, "EEE, MMM d");
  return format(date, "MMM d, yyyy");
};

export const formatRange = (from: Date, to: Date): string => {
  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** Joins names as "Asha, Rohan and Meera". */
export const listNames = (names: string[]): string => {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** Balance threshold the settlement maths already treats as "settled". */
export const EPSILON = 0.01;

/** Message from an Error or a Supabase/PostgREST error object. */
export const errorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

export interface DayRange {
  from: Date;
  to: Date;
}

export const sameRange = (a: DayRange, b: DayRange) =>
  isSameDay(a.from, b.from) && isSameDay(a.to, b.to);

/** "This month" (to today) and "Last month" (whole month). */
export const monthRanges = (today: Date = startOfDay(new Date())) => {
  const last = subMonths(today, 1);
  return {
    thisMonth: { from: startOfMonth(today), to: today },
    lastMonth: { from: startOfMonth(last), to: endOfMonth(last) },
  };
};
