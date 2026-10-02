import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The generated Database types predate split spaces, categories and the
 * split_space_id / category_id columns, so the typed client rejects queries the
 * live schema accepts. Until types.ts is regenerated, new code queries through
 * this untyped handle and types rows at the edge (see src/hooks/useSpaceData.ts).
 */
export const db = supabase as unknown as SupabaseClient;

export interface Flatmate {
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

export interface Expense {
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

export interface SupabaseErrorLike {
  message?: string;
  code?: string;
}

export const errorMessage = (error: unknown, fallback = "Something went wrong"): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as SupabaseErrorLike).message;
    if (message) return message;
  }
  return fallback;
};

export const errorCode = (error: unknown): string | undefined =>
  error && typeof error === "object" && "code" in error ? (error as SupabaseErrorLike).code : undefined;
