import { useMemo } from "react";
import { addDays } from "date-fns";
import type { Person, SavedSettlement, SpaceExpense } from "@/hooks/useSpaceData";
import { calculateBalances, calculateSettlements, type Balance, type Settlement } from "@/lib/settlement";
import {
  EMPTY_CATEGORY_FILTERS,
  EMPTY_PEOPLE_FILTERS,
  applyPeopleAndCategoryFilters,
  countActiveFilters,
  filterByDateRange,
  latestSettledDay,
  resolveDateRange,
  scopeFilters,
  type CategoryFilterValue,
  type DatePreset,
  type DateRange,
  type PeopleFilterValue,
} from "@/lib/expenseFilters";
import { formatDay, parseDay } from "@/lib/format";

interface SettleViewInput {
  people: Person[];
  expenses: SpaceExpense[];
  settlements: SavedSettlement[];
  preset: DatePreset;
  customRange?: DateRange;
  peopleFilters?: PeopleFilterValue;
  categoryFilters?: CategoryFilterValue;
  /** The user's categories, to ignore stored category filters that no longer exist. */
  categories?: { id: string }[];
}

export interface SettleView {
  range: DateRange;
  /** "yyyy-MM-dd" of the latest settle-up marker, if any. */
  lastSettled: string | null;
  /** e.g. "Since 1 Oct" or "All time"; used where Home talks about the open period. */
  openPeriodLabel: string;
  /** Expenses in the date range, before people/category filters. */
  inPeriod: SpaceExpense[];
  /** What the numbers are computed from. */
  filtered: SpaceExpense[];
  balances: Balance[];
  plan: Settlement[];
  total: number;
  transferTotal: number;
  activeFilters: number;
  /** The filters actually applied (stored ones minus IDs that don't belong here). */
  appliedPeopleFilters: PeopleFilterValue;
  appliedCategoryFilters: CategoryFilterValue;
  /** Expenses nobody is split on: the payer is credited in full and nobody owes. */
  zeroSplit: SpaceExpense[];
}

const NO_RANGE: DateRange = { from: new Date(), to: new Date() };

/**
 * The single place pages turn expenses into balances and a payment plan, so
 * Home and Settle up can never disagree. Calculation rules live in
 * src/lib/settlement.ts and are used unchanged.
 */
export const useSettleView = ({
  people,
  expenses,
  settlements,
  preset,
  customRange = NO_RANGE,
  peopleFilters = EMPTY_PEOPLE_FILTERS,
  categoryFilters = EMPTY_CATEGORY_FILTERS,
  categories,
}: SettleViewInput): SettleView => {
  const scoped = useMemo(
    () =>
      scopeFilters(peopleFilters, categoryFilters, {
        personIds: people.map((p) => p.id),
        categoryIds: categories?.map((c) => c.id),
      }),
    [peopleFilters, categoryFilters, people, categories]
  );
  const range = useMemo(
    () => resolveDateRange(preset, { expenses, settlements, customRange }),
    [preset, expenses, settlements, customRange]
  );
  const inPeriod = useMemo(() => filterByDateRange(expenses, range), [expenses, range]);
  const filtered = useMemo(
    () => applyPeopleAndCategoryFilters(inPeriod, scoped.people, scoped.categories),
    [inPeriod, scoped]
  );
  // Recomputed from the current list every time: an empty list means zero balances.
  const balances = useMemo(() => calculateBalances(people, filtered), [people, filtered]);
  const plan = useMemo(() => calculateSettlements(balances), [balances]);

  const lastSettled = latestSettledDay(settlements);

  return {
    range,
    lastSettled,
    openPeriodLabel: lastSettled ? `Since ${formatDay(addDays(parseDay(lastSettled), 1), "d MMM")}` : "All time",
    inPeriod,
    filtered,
    balances,
    plan,
    total: filtered.reduce((sum, e) => sum + e.amount, 0),
    transferTotal: plan.reduce((sum, s) => sum + s.amount, 0),
    activeFilters: countActiveFilters(scoped.people, scoped.categories),
    appliedPeopleFilters: scoped.people,
    appliedCategoryFilters: scoped.categories,
    zeroSplit: filtered.filter((e) => e.expense_splits.length === 0),
  };
};
