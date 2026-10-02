import { createContext, useContext } from "react";

/** The fields of an existing expense the composer needs to edit it. */
export interface ComposerExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  expense_splits: { flatmate_id: string }[];
}

export interface ExpenseComposerContextValue {
  /** Open the add form, or the edit form when given an expense. */
  openComposer: (expense?: ComposerExpense) => void;
  /** Bumps after every save or delete — add it to data-loading effect deps. */
  dataVersion: number;
}

export const ExpenseComposerContext = createContext<ExpenseComposerContextValue | null>(null);

export const useExpenseComposer = () => {
  const ctx = useContext(ExpenseComposerContext);
  if (!ctx) throw new Error("useExpenseComposer must be used inside <ExpenseComposerProvider>");
  return ctx;
};
