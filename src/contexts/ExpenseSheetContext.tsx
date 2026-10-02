import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { ExpenseSheet, type ExpenseSheetTarget } from "@/components/ExpenseSheet";
import type { Expense } from "@/lib/db";

interface ExpenseSheetContextValue {
  openNewExpense: () => void;
  openEditExpense: (expense: Expense) => void;
}

const ExpenseSheetContext = createContext<ExpenseSheetContextValue | undefined>(undefined);

/** One add/edit sheet for the whole app, reachable from any page. */
export const ExpenseSheetProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ExpenseSheetTarget>({ mode: "new" });
  const [openCount, setOpenCount] = useState(0);

  const show = useCallback((next: ExpenseSheetTarget) => {
    setTarget(next);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      openNewExpense: () => show({ mode: "new" }),
      openEditExpense: (expense: Expense) => show({ mode: "edit", expense }),
    }),
    [show]
  );

  return (
    <ExpenseSheetContext.Provider value={value}>
      {children}
      <ExpenseSheet open={open} target={target} openCount={openCount} onClose={() => setOpen(false)} />
    </ExpenseSheetContext.Provider>
  );
};

export const useExpenseSheet = () => {
  const context = useContext(ExpenseSheetContext);
  if (!context) throw new Error("useExpenseSheet must be used within an ExpenseSheetProvider");
  return context;
};
