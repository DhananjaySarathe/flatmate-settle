import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * The generated `Database` type predates the split-space and category
 * migrations, so it is missing the `split_spaces` and `categories` tables and
 * the `split_space_id` / `category_id` columns. Rather than hand-editing the
 * generated file, this module describes those pieces of the *existing* schema
 * (see supabase/migrations) and re-exports the same client with the fuller
 * type. Runtime behaviour is identical to importing `supabase` directly.
 */

type Generated = Database["public"]["Tables"];

type SplitSpacesTable = {
  Row: { id: string; name: string; created_by: string; created_at: string };
  Insert: { id?: string; name: string; created_by: string; created_at?: string };
  Update: { id?: string; name?: string; created_by?: string; created_at?: string };
  Relationships: [];
};

type CategoriesTable = {
  Row: {
    id: string;
    name: string;
    created_by: string;
    is_default: boolean | null;
    created_at: string | null;
  };
  Insert: {
    id?: string;
    name: string;
    created_by: string;
    is_default?: boolean | null;
    created_at?: string | null;
  };
  Update: {
    id?: string;
    name?: string;
    created_by?: string;
    is_default?: boolean | null;
    created_at?: string | null;
  };
  Relationships: [];
};

type FlatmatesTable = {
  Row: Generated["flatmates"]["Row"] & { split_space_id: string };
  Insert: Generated["flatmates"]["Insert"] & { split_space_id: string };
  Update: Generated["flatmates"]["Update"] & { split_space_id?: string };
  Relationships: [
    {
      foreignKeyName: "flatmates_split_space_id_fkey";
      columns: ["split_space_id"];
      isOneToOne: false;
      referencedRelation: "split_spaces";
      referencedColumns: ["id"];
    },
  ];
};

type ExpensesTable = {
  Row: Generated["expenses"]["Row"] & {
    split_space_id: string;
    category_id: string | null;
  };
  Insert: Generated["expenses"]["Insert"] & {
    split_space_id: string;
    category_id?: string | null;
  };
  Update: Generated["expenses"]["Update"] & {
    split_space_id?: string;
    category_id?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: "expenses_paid_by_fkey";
      columns: ["paid_by"];
      isOneToOne: false;
      referencedRelation: "flatmates";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "expenses_category_id_fkey";
      columns: ["category_id"];
      isOneToOne: false;
      referencedRelation: "categories";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "expenses_split_space_id_fkey";
      columns: ["split_space_id"];
      isOneToOne: false;
      referencedRelation: "split_spaces";
      referencedColumns: ["id"];
    },
  ];
};

export type AppDatabase = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Generated, "flatmates" | "expenses"> & {
      flatmates: FlatmatesTable;
      expenses: ExpensesTable;
      split_spaces: SplitSpacesTable;
      categories: CategoriesTable;
    };
  };
};

export type TableRow<T extends keyof AppDatabase["public"]["Tables"]> =
  AppDatabase["public"]["Tables"][T]["Row"];

export const db = supabase as unknown as SupabaseClient<AppDatabase>;

/** PostgREST caps a response at 1000 rows; page through until a short page. */
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

export const errorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};
