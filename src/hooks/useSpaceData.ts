import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import {
  db,
  errorCode,
  type Category,
  type Expense,
  type Flatmate,
  type SavedSettlement,
} from "@/lib/db";

export type { Category, Expense, Flatmate, SavedSettlement } from "@/lib/db";

/** PostgREST caps a response at 1000 rows by default, so expenses are read in pages. */
const PAGE_SIZE = 1000;

/** Rows created before split spaces existed have no space; they stay visible everywhere (as before). */
const scopeFilter = (spaceId: string) => `split_space_id.eq.${spaceId},split_space_id.is.null`;

export const queryKeys = {
  flatmates: (scope: string) => ["flatmates", scope] as const,
  expenses: (scope: string) => ["expenses", scope] as const,
  settlements: (scope: string) => ["settlements", scope] as const,
  categories: ["categories"] as const,
};

const fetchFlatmates = async (spaceId: string | null): Promise<Flatmate[]> => {
  let query = db.from("flatmates").select("id, name, email, phone, created_at").order("name");
  if (spaceId) query = query.or(scopeFilter(spaceId));
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Flatmate[];
};

type ExpenseRow = Omit<Expense, "amount"> & { amount: number | string };

const fetchExpenses = async (spaceId: string | null): Promise<Expense[]> => {
  const rows: ExpenseRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db
      .from("expenses")
      .select(
        "id, title, amount, date, paid_by, category_id, created_at, categories (name), expense_splits (flatmate_id)"
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (spaceId) query = query.or(scopeFilter(spaceId));
    const { data, error } = await query;
    if (error) throw error;
    // categories is a to-one embed (an object), which the untyped client can't know.
    const page = (data ?? []) as unknown as ExpenseRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    categories: row.categories ?? null,
    expense_splits: row.expense_splits ?? [],
  }));
};

const fetchSettlements = async (spaceId: string): Promise<SavedSettlement[]> => {
  const { data, error } = await db
    .from("settlements")
    .select("id, from_date, to_date, note, created_at")
    .eq("split_space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) {
    if (errorCode(error) === "42P01") return []; // table missing: migrations not run yet
    throw error;
  }
  return (data ?? []) as SavedSettlement[];
};

const fetchCategories = async (): Promise<Category[]> => {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from("categories")
    .select("id, name, is_default")
    .eq("created_by", user.id)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
};

/**
 * Which rows the current view covers: the selected space's id, or "all" for
 * accounts that predate split spaces. `null` while the space list is loading.
 */
export const useSpaceScope = () => {
  const { selectedSplitSpace, splitSpaces, loading } = useSplitSpace();
  if (loading) return { scope: null, spaceId: null, space: null };
  if (splitSpaces.length === 0) return { scope: "all", spaceId: null, space: null };
  if (!selectedSplitSpace) return { scope: null, spaceId: null, space: null };
  return { scope: selectedSplitSpace.id, spaceId: selectedSplitSpace.id, space: selectedSplitSpace };
};

export const useSpaceData = () => {
  const { scope, spaceId, space } = useSpaceScope();
  const ready = scope !== null;
  const key = scope ?? "pending";

  const flatmatesQuery = useQuery({
    queryKey: queryKeys.flatmates(key),
    queryFn: () => fetchFlatmates(spaceId),
    enabled: ready,
  });
  const expensesQuery = useQuery({
    queryKey: queryKeys.expenses(key),
    queryFn: () => fetchExpenses(spaceId),
    enabled: ready,
  });
  const settlementsQuery = useQuery({
    queryKey: queryKeys.settlements(key),
    queryFn: () => fetchSettlements(spaceId as string),
    enabled: ready && !!spaceId,
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    enabled: ready,
  });

  const queryClient = useQueryClient();
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["flatmates"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    queryClient.invalidateQueries({ queryKey: ["settlements"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  }, [queryClient]);

  return {
    scope,
    spaceId,
    space,
    flatmates: flatmatesQuery.data ?? [],
    expenses: expensesQuery.data ?? [],
    settlements: settlementsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    isLoading: !ready || flatmatesQuery.isPending || expensesQuery.isPending,
    error: flatmatesQuery.error ?? expensesQuery.error ?? null,
    refetch,
  };
};

/** Invalidate everything a write could have changed; components re-render from fresh data. */
export const useRefreshSpaceData = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (what: ("flatmates" | "expenses" | "settlements" | "categories")[] = ["flatmates", "expenses", "settlements"]) =>
      Promise.all(what.map((k) => queryClient.invalidateQueries({ queryKey: [k] }))),
    [queryClient]
  );
};
