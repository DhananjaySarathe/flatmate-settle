import { supabase } from "@/integrations/supabase/client";

export interface SpaceFlatmate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface SpaceExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id: string | null;
  created_at: string;
  categories: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

/**
 * Loads members and expenses for a split space. Rows with a NULL split_space_id
 * (pre-migration data) are included, matching Reports/Analytics.
 */
export const fetchSpaceData = async (splitSpaceId: string | null) => {
  let flatmatesQuery = supabase
    .from("flatmates")
    .select("id, name, email, phone")
    .order("created_at", { ascending: true });
  let expensesQuery = supabase
    .from("expenses")
    .select("id, title, amount, date, paid_by, category_id, created_at, categories (name), expense_splits (flatmate_id)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (splitSpaceId) {
    const scope = `split_space_id.eq.${splitSpaceId},split_space_id.is.null`;
    flatmatesQuery = flatmatesQuery.or(scope);
    expensesQuery = expensesQuery.or(scope);
  }

  const [flatmatesRes, expensesRes] = await Promise.all([flatmatesQuery, expensesQuery]);
  if (flatmatesRes.error) throw flatmatesRes.error;
  if (expensesRes.error) throw expensesRes.error;

  return {
    flatmates: (flatmatesRes.data ?? []) as SpaceFlatmate[],
    expenses: (expensesRes.data ?? []) as unknown as SpaceExpense[],
  };
};

export const errorMessage = (error: unknown, fallback = "Unknown error"): string =>
  error instanceof Error ? error.message : (error as { message?: string } | null)?.message || fallback;
