import { format, isValid, parseISO } from "date-fns";

const money2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "₹1,23,456.50". Uses the magnitude only when `signed` is false (the default). */
export const formatMoney = (
  amount: number,
  opts: { decimals?: 0 | 2; signed?: boolean } = {}
): string => {
  const { decimals = 2, signed = false } = opts;
  const value = Math.abs(amount) < 0.005 ? 0 : amount;
  const body = (decimals === 0 ? money0 : money2).format(Math.abs(value));
  const sign = value < 0 ? (signed ? "−" : "-") : signed && value > 0 ? "+" : "";
  return `${sign}₹${body}`;
};

/** Short form for tight spaces: drops paise when the amount is whole. */
export const formatMoneyCompact = (amount: number): string =>
  Math.abs(amount - Math.round(amount)) < 0.005
    ? formatMoney(amount, { decimals: 0 })
    : formatMoney(amount);

/**
 * `date` columns arrive as "yyyy-MM-dd". `new Date("2025-01-31")` parses that
 * as UTC midnight, which shows the previous day west of Greenwich, so always
 * go through parseISO (local midnight).
 */
export const parseDay = (value: string): Date => {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date(value);
};

export const toDayKey = (date: Date): string => format(date, "yyyy-MM-dd");

export const formatDay = (value: string | Date, pattern = "d MMM yyyy"): string =>
  format(typeof value === "string" ? parseDay(value) : value, pattern);

export const formatRange = (from: Date, to: Date): string => {
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${format(from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Parses user-typed amounts like "1,250.5" or "₹ 300". Returns NaN when invalid. */
export const parseAmount = (input: string): number => {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === ".") return NaN;
  return Number(cleaned);
};

/** Matches the 0.01 tolerance used by src/lib/settlement.ts. */
export const balanceStatus = (balance: number): "gets-back" | "owes" | "settled" =>
  balance > 0.01 ? "gets-back" : balance < -0.01 ? "owes" : "settled";

/** "Split with everyone (4)", "All for Diya", "Split with Aarav, Diya". */
export const describeSplit = (
  splitIds: string[],
  nameOf: (id: string) => string,
  peopleCount: number
): string => {
  if (splitIds.length === 0) return "Nobody in split";
  if (splitIds.length === peopleCount && peopleCount > 1) return `Split with everyone (${splitIds.length})`;
  if (splitIds.length === 1) return `All for ${nameOf(splitIds[0])}`;
  return `Split with ${splitIds.map(nameOf).join(", ")}`;
};
