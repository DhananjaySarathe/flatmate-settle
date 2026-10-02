import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { ExpenseFormSheet, EditableExpense } from "@/components/expenses/ExpenseFormSheet";

interface ExpenseDialogContextType {
  openAddExpense: () => void;
  openEditExpense: (expense: EditableExpense) => void;
  /** Bumps after every save/delete so pages can refetch. */
  dataVersion: number;
}

const ExpenseDialogContext = createContext<ExpenseDialogContextType | undefined>(undefined);

/** One add/edit expense sheet for the whole app, reachable from any page. */
export const ExpenseDialogProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableExpense | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const openAddExpense = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEditExpense = useCallback((expense: EditableExpense) => {
    setEditing(expense);
    setOpen(true);
  }, []);

  return (
    <ExpenseDialogContext.Provider value={{ openAddExpense, openEditExpense, dataVersion }}>
      {children}
      <ExpenseFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => setDataVersion((v) => v + 1)}
      />
    </ExpenseDialogContext.Provider>
  );
};

export const useExpenseDialog = () => {
  const ctx = useContext(ExpenseDialogContext);
  if (!ctx) throw new Error("useExpenseDialog must be used within an ExpenseDialogProvider");
  return ctx;
};
