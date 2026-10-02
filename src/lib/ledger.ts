import { addDays, max as maxDate } from "date-fns";
import {
  calculateBalances,
  calculateSettlements,
  type Balance,
  type Settlement,
} from "@/lib/settlement";
import type { Expense, Flatmate, SavedSettlement } from "@/lib/db";
import { parseDateOnly, toDateOnly } from "@/lib/format";

export interface Payment {
  fromId: string;
  toId: string;
  amount: number;
}

export interface Ledger {
  balances: Balance[];
  /** Name-keyed plan, exactly as calculateSettlements returns it (used by exports and share snapshots). */
  settlements: Settlement[];
  /** The same plan keyed by flatmate id, so duplicate names can't be confused. */
  payments: Payment[];
  total: number;
}

/**
 * Balances and the settle-up plan for a set of expenses. All maths is delegated to
 * src/lib/settlement.ts; the id-keyed plan runs the identical algorithm with ids in
 * place of names (the greedy pass never reads names, so the plans match one to one).
 */
export const buildLedger = (flatmates: Flatmate[], expenses: Expense[]): Ledger => {
  const balances = calculateBalances(flatmates, expenses);
  const settlements = calculateSettlements(balances);
  const payments = calculateSettlements(balances.map((b) => ({ ...b, name: b.id }))).map((s) => ({
    fromId: s.from,
    toId: s.to,
    amount: s.amount,
  }));
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { balances, settlements, payments, total };
};

export interface OpenPeriod {
  /** Settled period this one follows, if any. */
  lastSettlement: SavedSettlement | null;
  /** First day not covered by a settled period (yyyy-MM-dd), or null when nothing was ever settled. */
  startsOn: string | null;
  expenses: Expense[];
}

/** The latest settled period by end date (not by when it was marked). */
export const latestSettlement = (settlements: SavedSettlement[]): SavedSettlement | null =>
  settlements.reduce<SavedSettlement | null>(
    (latest, s) => (!latest || s.to_date > latest.to_date ? s : latest),
    null
  );

/**
 * Expenses that the next settle-up covers: everything dated after the most recent
 * settled period (the settlements table exists to mark "where the next settlement
 * should pick up"). With no settled periods, that's every expense.
 */
export const openPeriod = (expenses: Expense[], settlements: SavedSettlement[]): OpenPeriod => {
  const last = latestSettlement(settlements);
  if (!last) return { lastSettlement: null, startsOn: null, expenses };
  return {
    lastSettlement: last,
    startsOn: toDateOnly(addDays(parseDateOnly(last.to_date), 1)),
    expenses: expenses.filter((e) => e.date > last.to_date),
  };
};

/** Date range to record when marking the open period settled. */
export const openPeriodRange = (period: OpenPeriod): { from: Date; to: Date } => {
  const today = new Date();
  const dates = period.expenses.map((e) => parseDateOnly(e.date));
  const from = period.startsOn
    ? parseDateOnly(period.startsOn)
    : dates.length > 0
      ? dates.reduce((a, b) => (a < b ? a : b))
      : today;
  // Future-dated expenses belong to the period too.
  const to = dates.length > 0 ? maxDate([today, ...dates]) : today;
  return { from: from > to ? to : from, to };
};
