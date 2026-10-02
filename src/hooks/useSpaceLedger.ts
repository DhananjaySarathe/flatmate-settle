import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, max as maxDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { errorMessage, parseDay } from "@/lib/format";

export interface LedgerFlatmate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface LedgerExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  categories?: { name: string } | null;
  flatmates?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

export interface LedgerSettlement {
  id: string;
  from_date: string;
  to_date: string;
  note: string | null;
  created_at: string;
}

const EXPENSE_SELECT = `
  *,
  flatmates!expenses_paid_by_fkey (name),
  categories (name),
  expense_splits (flatmate_id)
`;

/**
 * Flatmates, expenses and saved settle-ups for the selected split space.
 * Same scoping as the individual pages: rows in this space, plus legacy rows
 * with no space (pre-migration data). With no spaces at all, nothing is filtered.
 */
export const useSpaceLedger = (refreshKey = 0) => {
  const { selectedSplitSpace, splitSpaces, loading: contextLoading } = useSplitSpace();
  const [flatmates, setFlatmates] = useState<LedgerFlatmate[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [settlements, setSettlements] = useState<LedgerSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const spaceId = selectedSplitSpace?.id ?? null;
  const hasSpaces = splitSpaces.length > 0;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const scope = spaceId ? `split_space_id.eq.${spaceId},split_space_id.is.null` : null;

      let flatmatesQuery = supabase
        .from("flatmates")
        .select("id, name, email, phone")
        .order("created_at", { ascending: true });
      let expensesQuery = supabase
        .from("expenses")
        .select(EXPENSE_SELECT)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (scope) {
        flatmatesQuery = flatmatesQuery.or(scope);
        expensesQuery = expensesQuery.or(scope);
      }

      const settlementsQuery = spaceId
        ? supabase
            .from("settlements")
            .select("id, from_date, to_date, note, created_at")
            .eq("split_space_id", spaceId)
            .order("to_date", { ascending: false })
        : Promise.resolve({ data: [] as LedgerSettlement[], error: null });

      const [flatmatesRes, expensesRes, settlementsRes] = await Promise.all([
        flatmatesQuery,
        expensesQuery,
        settlementsQuery,
      ]);
      if (id !== requestId.current) return;

      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates((flatmatesRes.data as LedgerFlatmate[]) || []);
      setExpenses((expensesRes.data as unknown as LedgerExpense[]) || []);
      // A missing settlements table (migrations not run) just means "never settled".
      setSettlements(settlementsRes.error ? [] : (settlementsRes.data as LedgerSettlement[]) || []);
    } catch (err: unknown) {
      if (id !== requestId.current) return;
      console.error("Error loading space data:", err);
      setError(errorMessage(err, "Couldn't load this space"));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (contextLoading) return;
    if (hasSpaces && !spaceId) {
      setLoading(false);
      return;
    }
    load();
  }, [contextLoading, hasSpaces, spaceId, load, refreshKey]);

  return { flatmates, expenses, settlements, loading: loading || contextLoading, error, reload: load };
};

export interface OpenWindow {
  /** Last day covered by the most recent settle-up, or null if never settled. */
  settledThrough: string | null;
  /** Expenses dated after `settledThrough` (all expenses if never settled). */
  openExpenses: LedgerExpense[];
  /** Date range covering the open expenses — what Settle up should load. */
  range: { from: Date; to: Date } | null;
}

/**
 * The "open" period: everything after the latest saved settle-up. Settle-ups
 * are date ranges (see the settlements migration) recording where the next
 * settlement should pick up, so the newest `to_date` is the cut-off.
 */
export const getOpenWindow = (
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[]
): OpenWindow => {
  const settledThrough = settlements.reduce<string | null>(
    (latest, s) => (latest === null || s.to_date > latest ? s.to_date : latest),
    null
  );
  const openExpenses = settledThrough
    ? expenses.filter((e) => e.date > settledThrough)
    : expenses;

  const today = new Date();
  let range: OpenWindow["range"] = null;
  if (settledThrough) {
    const from = addDays(parseDay(settledThrough), 1);
    const latest = openExpenses.length
      ? maxDate(openExpenses.map((e) => parseDay(e.date)))
      : today;
    range = { from, to: maxDate([today, latest, from]) };
  } else if (expenses.length) {
    const dates = expenses.map((e) => parseDay(e.date));
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    range = { from: earliest, to: maxDate([today, ...dates]) };
  }
  return { settledThrough, openExpenses, range };
};

