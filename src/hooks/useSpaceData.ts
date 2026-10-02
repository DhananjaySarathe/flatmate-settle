import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";

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
  category_id?: string | null;
  categories?: { name: string } | null;
  flatmates?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

export interface SavedSettlement {
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

const isMissingColumn = (error: any) =>
  error?.message?.includes("column") || error?.code === "42703";

/**
 * Loads people, expenses and marked settlements for the selected split space.
 * Uses the same space filter as the other pages (rows in this space, or legacy
 * rows with no space), and falls back to unfiltered reads when the database
 * predates split spaces.
 */
export const useSpaceData = ({ withSettlements = false } = {}) => {
  const { selectedSplitSpace, splitSpaces, loading: contextLoading } = useSplitSpace();
  const [flatmates, setFlatmates] = useState<SpaceFlatmate[]>([]);
  const [expenses, setExpenses] = useState<SpaceExpense[]>([]);
  const [settlements, setSettlements] = useState<SavedSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  const spaceId = selectedSplitSpace?.id;
  const needsSpace = splitSpaces.length > 0 && !spaceId;

  const load = useCallback(async () => {
    if (contextLoading || needsSpace) return;
    try {
      let flatmatesQuery = supabase.from("flatmates").select("*").order("created_at", { ascending: true });
      let expensesQuery = supabase
        .from("expenses")
        .select(EXPENSE_SELECT)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (spaceId) {
        const scope = `split_space_id.eq.${spaceId},split_space_id.is.null`;
        flatmatesQuery = flatmatesQuery.or(scope);
        expensesQuery = expensesQuery.or(scope);
      }

      let [flatmatesRes, expensesRes] = await Promise.all([flatmatesQuery, expensesQuery]);

      if (flatmatesRes.error && isMissingColumn(flatmatesRes.error)) {
        flatmatesRes = await supabase.from("flatmates").select("*").order("created_at", { ascending: true });
      }
      if (expensesRes.error && isMissingColumn(expensesRes.error)) {
        expensesRes = await supabase
          .from("expenses")
          .select(EXPENSE_SELECT)
          .order("date", { ascending: false });
      }
      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates((flatmatesRes.data as SpaceFlatmate[]) || []);
      setExpenses((expensesRes.data as unknown as SpaceExpense[]) || []);

      if (withSettlements && spaceId) {
        const { data, error } = await supabase
          .from("settlements")
          .select("id, from_date, to_date, note, created_at")
          .eq("split_space_id", spaceId)
          .order("to_date", { ascending: false });
        // Settlements are optional context; a failure here shouldn't block the page.
        if (error) console.error("Failed to load settlements:", error);
        setSettlements(data || []);
      } else {
        setSettlements([]);
      }
    } catch (error: any) {
      console.error("Error loading space data:", error);
      toast.error(`Couldn't load your data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [contextLoading, needsSpace, spaceId, withSettlements]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return {
    flatmates,
    expenses,
    settlements,
    loading: loading || contextLoading,
    needsSpace,
    refresh: load,
  };
};
