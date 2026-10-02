import { differenceInCalendarDays, format, isValid, parse } from "date-fns";

/** Amounts below this are treated as zero (matches the 0.01 tolerance in settlement.ts). */
export const MONEY_EPSILON = 0.01;

const inr2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inr0 = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** "₹1,23,456.50". Negative values keep their sign: "-₹40.00". */
export const formatMoney = (value: number, opts: { decimals?: 0 | 2 } = {}): string => {
  const n = Number.isFinite(value) ? value : 0;
  const formatter = opts.decimals === 0 ? inr0 : inr2;
  const body = formatter.format(Math.abs(n));
  return n < 0 && Math.abs(n) >= (opts.decimals === 0 ? 0.5 : 0.005) ? `-₹${body}` : `₹${body}`;
};

/** Short axis/tick label: ₹950, ₹1.2k, ₹3.4L. */
export const formatMoneyShort = (value: number): string => {
  const n = Math.abs(value);
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `₹${n.toFixed(0)}`;
};

export const isZero = (n: number) => Math.abs(n) < MONEY_EPSILON;

/**
 * Parse a Postgres DATE ("2026-09-14") as a local calendar date.
 * `new Date("2026-09-14")` is UTC midnight, which shows the previous day west of UTC.
 */
export const parseDateOnly = (value: string): Date => {
  const d = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : new Date(value);
};

export const toDateOnly = (d: Date): string => format(d, "yyyy-MM-dd");

export const todayDateOnly = (): string => toDateOnly(new Date());

/** "Today", "Yesterday", "Sep 14", or "Sep 14, 2025" outside the current year. */
export const formatDayLabel = (value: string | Date): string => {
  const d = typeof value === "string" ? parseDateOnly(value) : value;
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.getFullYear() === new Date().getFullYear() ? format(d, "MMM d") : format(d, "MMM d, yyyy");
};

/** "Sep 1 – Sep 30, 2026" with the year shown once when both ends share it. */
export const formatRange = (from: Date, to: Date): string => {
  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
};

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
