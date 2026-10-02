import type { Expense } from "@/lib/db";

export interface PeopleFilterValue {
  exactMatch: string[];
  anyMatch: string[];
  exclude: string[];
  paidBy: string[];
}

export interface CategoryFilterValue {
  include: string[];
  exclude: string[];
}

export const EMPTY_PEOPLE_FILTERS: PeopleFilterValue = { exactMatch: [], anyMatch: [], exclude: [], paidBy: [] };
export const EMPTY_CATEGORY_FILTERS: CategoryFilterValue = { include: [], exclude: [] };

/** Same rules the Reports and Analytics pages have always applied, in one place. */
export const applyExpenseFilters = (
  expenses: Expense[],
  people: PeopleFilterValue,
  categories: CategoryFilterValue
): Expense[] =>
  expenses.filter((expense) => {
    const ids = expense.expense_splits.map((s) => s.flatmate_id);
    if (people.exactMatch.length > 0 && !people.exactMatch.every((id) => ids.includes(id))) return false;
    if (people.anyMatch.length > 0 && !people.anyMatch.some((id) => ids.includes(id))) return false;
    // Excluded people hide an expense whether they paid for it or were in the split.
    if (people.exclude.some((id) => ids.includes(id) || expense.paid_by === id)) return false;
    if (people.paidBy.length > 0 && !people.paidBy.includes(expense.paid_by)) return false;
    if (categories.include.length > 0 && !(expense.category_id && categories.include.includes(expense.category_id)))
      return false;
    if (categories.exclude.length > 0 && expense.category_id && categories.exclude.includes(expense.category_id))
      return false;
    return true;
  });

/** Inclusive yyyy-MM-dd bounds; DATE columns compare correctly as strings. */
export const inRange = (expenses: Expense[], from: string, to: string) =>
  expenses.filter((e) => e.date >= from && e.date <= to);

export const countActiveFilters = (people: PeopleFilterValue, categories: CategoryFilterValue) =>
  people.exactMatch.length +
  people.anyMatch.length +
  people.exclude.length +
  people.paidBy.length +
  categories.include.length +
  categories.exclude.length;
