import {
  addDays,
  endOfMonth,
  max as maxDate,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { parseDay, toDayKey } from "@/lib/format";

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

export interface DateRange {
  from: Date;
  to: Date;
}

export type DatePreset = "since-settlement" | "this-month" | "last-month" | "all-time" | "custom";

interface FilterableExpense {
  date: string;
  paid_by: string;
  category_id?: string | null;
  expense_splits: { flatmate_id: string }[];
}

export const EMPTY_PEOPLE_FILTERS: PeopleFilterValue = {
  exactMatch: [],
  anyMatch: [],
  exclude: [],
  paidBy: [],
};

export const EMPTY_CATEGORY_FILTERS: CategoryFilterValue = { include: [], exclude: [] };

/**
 * Filters are persisted for all groups, but people belong to one group (and a
 * stored category may no longer exist). Ignore IDs that don't apply here, so
 * switching groups never hides every expense behind filters you can't see.
 */
export const scopeFilters = (
  people: PeopleFilterValue,
  categories: CategoryFilterValue,
  known: { personIds: string[]; categoryIds?: string[] }
): { people: PeopleFilterValue; categories: CategoryFilterValue } => {
  const personSet = new Set(known.personIds);
  const keepPerson = (ids: string[]) => ids.filter((id) => personSet.has(id));
  const categorySet = known.categoryIds ? new Set(known.categoryIds) : null;
  const keepCategory = (ids: string[]) => (categorySet ? ids.filter((id) => categorySet.has(id)) : ids);
  return {
    people: {
      exactMatch: keepPerson(people.exactMatch),
      anyMatch: keepPerson(people.anyMatch),
      exclude: keepPerson(people.exclude),
      paidBy: keepPerson(people.paidBy),
    },
    categories: { include: keepCategory(categories.include), exclude: keepCategory(categories.exclude) },
  };
};

export const countActiveFilters = (people: PeopleFilterValue, categories: CategoryFilterValue) =>
  people.exactMatch.length +
  people.anyMatch.length +
  people.exclude.length +
  people.paidBy.length +
  categories.include.length +
  categories.exclude.length;

/** Same semantics the Reports and Analytics pages have always applied. */
export const applyPeopleAndCategoryFilters = <T extends FilterableExpense>(
  expenses: T[],
  people: PeopleFilterValue,
  categories: CategoryFilterValue
): T[] =>
  expenses.filter((expense) => {
    const inSplit = expense.expense_splits.map((s) => s.flatmate_id);
    if (people.exactMatch.length > 0 && !people.exactMatch.every((id) => inSplit.includes(id))) {
      return false;
    }
    if (people.anyMatch.length > 0 && !people.anyMatch.some((id) => inSplit.includes(id))) {
      return false;
    }
    // Excluded people hide an expense they are split on OR paid for.
    if (people.exclude.some((id) => inSplit.includes(id) || expense.paid_by === id)) {
      return false;
    }
    if (people.paidBy.length > 0 && !people.paidBy.includes(expense.paid_by)) {
      return false;
    }
    if (
      categories.include.length > 0 &&
      !(expense.category_id && categories.include.includes(expense.category_id))
    ) {
      return false;
    }
    if (
      categories.exclude.length > 0 &&
      expense.category_id &&
      categories.exclude.includes(expense.category_id)
    ) {
      return false;
    }
    return true;
  });

/** Inclusive day-level range check on "yyyy-MM-dd" strings (no timezone drift). */
export const filterByDateRange = <T extends { date: string }>(expenses: T[], range: DateRange): T[] => {
  const from = toDayKey(range.from);
  const to = toDayKey(range.to);
  return expenses.filter((e) => e.date >= from && e.date <= to);
};

export const latestSettledDay = (settlements: { to_date: string }[]): string | null =>
  settlements.reduce<string | null>(
    (latest, s) => (latest === null || s.to_date > latest ? s.to_date : latest),
    null
  );

interface ResolveInput {
  expenses: { date: string }[];
  settlements: { to_date: string }[];
  customRange: DateRange;
  today?: Date;
}

/** Earliest and latest expense day, or null when there are none. */
const expenseBounds = (expenses: { date: string }[]) => {
  if (expenses.length === 0) return null;
  let min = expenses[0].date;
  let max = expenses[0].date;
  for (const e of expenses) {
    if (e.date < min) min = e.date;
    if (e.date > max) max = e.date;
  }
  return { min: parseDay(min), max: parseDay(max) };
};

/**
 * Turns a preset into concrete dates. Dynamic presets are resolved from the
 * data each render, so they never go stale the way a stored range does.
 */
export const resolveDateRange = (
  preset: DatePreset,
  { expenses, settlements, customRange, today = new Date() }: ResolveInput
): DateRange => {
  const now = startOfDay(today);
  const bounds = expenseBounds(expenses);
  const openEnd = bounds ? maxDate([now, bounds.max]) : now;

  switch (preset) {
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last-month": {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case "since-settlement": {
      const settled = latestSettledDay(settlements);
      if (settled) {
        const from = addDays(parseDay(settled), 1);
        return { from, to: maxDate([from, openEnd]) };
      }
      return { from: bounds ? bounds.min : startOfMonth(now), to: openEnd };
    }
    case "all-time":
      return { from: bounds ? bounds.min : startOfMonth(now), to: openEnd };
    case "custom":
    default:
      return customRange;
  }
};

export const presetLabel = (preset: DatePreset, hasSettlements: boolean): string => {
  switch (preset) {
    case "since-settlement":
      return hasSettlements ? "Since last settle-up" : "All time";
    case "this-month":
      return "This month";
    case "last-month":
      return "Last month";
    case "all-time":
      return "All time";
    default:
      return "Custom";
  }
};
