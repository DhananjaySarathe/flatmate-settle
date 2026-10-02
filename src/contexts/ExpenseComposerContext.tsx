import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useExpenses, usePeople, useSavedSettlements, type SpaceExpense } from "@/hooks/useSpaceData";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { ExpenseDetailSheet } from "@/components/expenses/ExpenseDetailSheet";

interface ComposerState {
  open: boolean;
  /** null = new expense */
  expense: SpaceExpense | null;
  session: number;
}

interface ExpenseComposerContextValue {
  openNew: () => void;
  openEdit: (expense: SpaceExpense) => void;
  /** Read-only breakdown of one expense, with Edit and Delete. */
  openDetail: (expense: SpaceExpense) => void;
}

const ExpenseComposerContext = createContext<ExpenseComposerContextValue | undefined>(undefined);

/** Lets any screen open the add/edit expense form or an expense's breakdown without owning their state. */
export const ExpenseComposerProvider = ({ children }: { children: ReactNode }) => {
  const { selectedSplitSpace } = useSplitSpace();
  const spaceId = selectedSplitSpace?.id;
  const people = usePeople(spaceId);
  const expenses = useExpenses(spaceId);
  const settlements = useSavedSettlements(spaceId);

  const [state, setState] = useState<ComposerState>({ open: false, expense: null, session: 0 });
  const [detail, setDetail] = useState<SpaceExpense | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openNew = useCallback(
    () => setState((prev) => ({ open: true, expense: null, session: prev.session + 1 })),
    []
  );
  const openEdit = useCallback((expense: SpaceExpense) => {
    setDetailOpen(false);
    setState((prev) => ({ open: true, expense, session: prev.session + 1 }));
  }, []);
  const openDetail = useCallback((expense: SpaceExpense) => {
    setDetail(expense);
    setDetailOpen(true);
  }, []);
  const value = useMemo(() => ({ openNew, openEdit, openDetail }), [openNew, openEdit, openDetail]);

  // Show the freshest copy if the list refetched while the sheet is open.
  const liveDetail = detail ? (expenses.data?.find((e) => e.id === detail.id) ?? detail) : null;

  return (
    <ExpenseComposerContext.Provider value={value}>
      {children}
      <ExpenseFormDialog
        open={state.open}
        expense={state.expense}
        session={state.session}
        onOpenChange={(open) => setState((prev) => ({ ...prev, open }))}
      />
      <ExpenseDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        spaceId={spaceId}
        expense={liveDetail}
        people={people.data ?? []}
        settlements={settlements.data ?? []}
        onEdit={openEdit}
      />
    </ExpenseComposerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useExpenseComposer = () => {
  const context = useContext(ExpenseComposerContext);
  if (!context) throw new Error("useExpenseComposer must be used within ExpenseComposerProvider");
  return context;
};
