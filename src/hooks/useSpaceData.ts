import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { db, fetchAllPages } from "@/lib/db";

export interface Person {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  is_default: boolean | null;
}

export interface SpaceExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id: string | null;
  created_at: string | null;
  categories: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

export interface SavedSettlement {
  id: string;
  from_date: string;
  to_date: string;
  note: string | null;
  created_at: string;
}

export const spaceKeys = {
  space: (spaceId: string) => ["space", spaceId] as const,
  people: (spaceId: string) => ["space", spaceId, "people"] as const,
  expenses: (spaceId: string) => ["space", spaceId, "expenses"] as const,
  settlements: (spaceId: string) => ["space", spaceId, "settlements"] as const,
  categories: ["categories"] as const,
};

const STALE_TIME = 30_000;

/**
 * Rows created before split spaces existed may have no split_space_id; RLS
 * still lets their owner read them and the app has always shown them in every
 * space, so keep that visibility rather than letting records disappear.
 */
const inSpace = (spaceId: string) => `split_space_id.eq.${spaceId},split_space_id.is.null`;

const fetchPeople = async (spaceId: string): Promise<Person[]> => {
  const { data, error } = await db
    .from("flatmates")
    .select("id, name, email, phone, created_at")
    .or(inSpace(spaceId))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

const fetchExpenses = async (spaceId: string): Promise<SpaceExpense[]> => {
  const rows = await fetchAllPages((from, to) =>
    db
      .from("expenses")
      .select(
        "id, title, amount, date, paid_by, category_id, created_at, categories (name), expense_splits (flatmate_id)"
      )
      .or(inSpace(spaceId))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    categories: (row.categories as SpaceExpense["categories"]) ?? null,
    expense_splits: (row.expense_splits as SpaceExpense["expense_splits"]) ?? [],
  }));
};

const fetchSettlements = async (spaceId: string): Promise<SavedSettlement[]> => {
  const { data, error } = await db
    .from("settlements")
    .select("id, from_date, to_date, note, created_at")
    .eq("split_space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
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
  return data ?? [];
};

export const usePeople = (spaceId: string | undefined) =>
  useQuery({
    queryKey: spaceKeys.people(spaceId ?? ""),
    queryFn: () => fetchPeople(spaceId!),
    enabled: !!spaceId,
    staleTime: STALE_TIME,
  });

export const useExpenses = (spaceId: string | undefined) =>
  useQuery({
    queryKey: spaceKeys.expenses(spaceId ?? ""),
    queryFn: () => fetchExpenses(spaceId!),
    enabled: !!spaceId,
    staleTime: STALE_TIME,
  });

export const useSavedSettlements = (spaceId: string | undefined) =>
  useQuery({
    queryKey: spaceKeys.settlements(spaceId ?? ""),
    queryFn: () => fetchSettlements(spaceId!),
    enabled: !!spaceId,
    staleTime: STALE_TIME,
  });

export const useCategories = () =>
  useQuery({
    queryKey: spaceKeys.categories,
    queryFn: fetchCategories,
    staleTime: STALE_TIME,
  });

/** Everything a page in the selected space usually needs, fetched once and cached. */
export const useSpaceData = (spaceId: string | undefined) => {
  const people = usePeople(spaceId);
  const expenses = useExpenses(spaceId);
  const settlements = useSavedSettlements(spaceId);
  const categories = useCategories();

  const queries = [people, expenses, settlements, categories];
  const error = queries.find((q) => q.error)?.error ?? null;

  return {
    people: people.data ?? [],
    expenses: expenses.data ?? [],
    settlements: settlements.data ?? [],
    categories: categories.data ?? [],
    /** True only on the first load; background refetches keep showing data. */
    isLoading: !!spaceId && queries.some((q) => q.isPending),
    isFetching: queries.some((q) => q.isFetching),
    error,
    refetch: () => Promise.all(queries.map((q) => q.refetch())),
  };
};

export const useRefreshSpace = () => {
  const queryClient = useQueryClient();
  return useCallback(
    async (spaceId: string | undefined, opts: { categories?: boolean } = {}) => {
      const tasks: Promise<unknown>[] = [];
      if (spaceId) {
        tasks.push(queryClient.invalidateQueries({ queryKey: spaceKeys.space(spaceId) }));
      }
      if (opts.categories) {
        tasks.push(queryClient.invalidateQueries({ queryKey: spaceKeys.categories }));
      }
      await Promise.all(tasks);
    },
    [queryClient]
  );
};
