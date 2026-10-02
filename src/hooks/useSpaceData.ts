import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseDialog } from "@/contexts/ExpenseDialogContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/format";

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
  expense_splits: { flatmate_id: string }[];
}

export interface SavedSettlement {
  id: string;
  from_date: string;
  to_date: string;
  note: string | null;
  created_at: string;
}

/**
 * Loads flatmates, expenses and marked settlements for the selected split
 * space. Same queries the pages used before (rows with a NULL split_space_id
 * are pre-migration data and stay visible). Refetches whenever an expense is
 * saved through the global expense dialog.
 */
export const useSpaceData = () => {
  const { selectedSplitSpace, splitSpaces, loading: spacesLoading } = useSplitSpace();
  const { dataVersion } = useExpenseDialog();
  const [flatmates, setFlatmates] = useState<SpaceFlatmate[]>([]);
  const [expenses, setExpenses] = useState<SpaceExpense[]>([]);
  const [savedSettlements, setSavedSettlements] = useState<SavedSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  const spaceId = selectedSplitSpace?.id;
  // No spaces at all means split spaces were never set up — show everything.
  const unscoped = !spacesLoading && splitSpaces.length === 0;

  const fetchAll = useCallback(async () => {
    if (!spaceId && !unscoped) return;
    try {
      let fq = supabase.from("flatmates").select("id, name, email, phone").order("name");
      let eq = supabase
        .from("expenses")
        .select("*, categories (name), expense_splits (flatmate_id)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (spaceId) {
        const scope = `split_space_id.eq.${spaceId},split_space_id.is.null`;
        fq = fq.or(scope);
        eq = eq.or(scope);
      }

      const [fRes, eRes, sRes] = await Promise.all([
        fq,
        eq,
        spaceId
          ? supabase
              .from("settlements")
              .select("id, from_date, to_date, note, created_at")
              .eq("split_space_id", spaceId)
              .order("to_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (fRes.error) throw fRes.error;
      if (eRes.error) throw eRes.error;
      setFlatmates(fRes.data || []);
      setExpenses(((eRes.data as unknown) as SpaceExpense[]) || []);
      // The settlements table may not exist on older databases; treat as empty.
      setSavedSettlements(sRes.error ? [] : (sRes.data as SavedSettlement[]) || []);
    } catch (error) {
      console.error("Error loading split space data:", error);
      toast.error(`Couldn't load data: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [spaceId, unscoped]);

  useEffect(() => {
    if (spacesLoading) return;
    setLoading(true);
    fetchAll();
  }, [fetchAll, spacesLoading, dataVersion]);

  return {
    flatmates,
    expenses,
    savedSettlements,
    loading: loading || spacesLoading,
    refetch: fetchAll,
    hasSpace: !!spaceId || unscoped,
  };
};
