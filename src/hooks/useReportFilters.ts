import { useState, useEffect, useCallback } from "react";
import {
  EMPTY_CATEGORY_FILTERS,
  EMPTY_PEOPLE_FILTERS,
  type CategoryFilterValue,
  type DatePreset,
  type DateRange,
  type PeopleFilterValue,
} from "@/lib/expenseFilters";

interface ReportFiltersState {
  peopleFilters: PeopleFilterValue;
  categoryFilters: CategoryFilterValue;
  /** The range used when `datePreset` is "custom". */
  dateRange: DateRange;
  datePreset: DatePreset;
}

const STORAGE_KEY = "reportFilters";

const PRESETS: DatePreset[] = ["since-settlement", "this-month", "last-month", "all-time", "custom"];

const defaultRange = (): DateRange => ({
  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  to: new Date(),
});

const defaultState = (): ReportFiltersState => ({
  peopleFilters: EMPTY_PEOPLE_FILTERS,
  categoryFilters: EMPTY_CATEGORY_FILTERS,
  dateRange: defaultRange(),
  datePreset: "since-settlement",
});

const toDate = (value: unknown, fallback: Date) => {
  const d = typeof value === "string" ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};

/**
 * Before presets existed the stored range was almost always the old default
 * ("1st of the month → day of the last visit"). Treat that shape as the new
 * default instead of pinning people to a stale range; anything else was a
 * deliberate choice and stays as a custom range.
 */
const presetForLegacyRange = (range: DateRange): DatePreset => {
  const looksLikeOldDefault =
    range.from.getDate() === 1 &&
    range.from.getMonth() === range.to.getMonth() &&
    range.from.getFullYear() === range.to.getFullYear();
  return looksLikeOldDefault ? "since-settlement" : "custom";
};

const loadState = (): ReportFiltersState => {
  const fallback = defaultState();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    const dateRange = {
      from: toDate(parsed.dateRange?.from, fallback.dateRange.from),
      to: toDate(parsed.dateRange?.to, fallback.dateRange.to),
    };
    return {
      peopleFilters: { ...EMPTY_PEOPLE_FILTERS, ...(parsed.peopleFilters ?? {}) },
      categoryFilters: { ...EMPTY_CATEGORY_FILTERS, ...(parsed.categoryFilters ?? {}) },
      dateRange,
      datePreset: PRESETS.includes(parsed.datePreset)
        ? parsed.datePreset
        : presetForLegacyRange(dateRange),
    };
  } catch (error) {
    console.error("Error parsing stored filters:", error);
    return fallback;
  }
};

/**
 * Filters shared by Settle up (Reports) and Insights (Analytics), persisted so a
 * filter set survives navigation between them.
 */
export const useReportFilters = () => {
  const [state, setState] = useState<ReportFiltersState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          peopleFilters: state.peopleFilters,
          categoryFilters: state.categoryFilters,
          datePreset: state.datePreset,
          dateRange: {
            from: state.dateRange.from.toISOString(),
            to: state.dateRange.to.toISOString(),
          },
        })
      );
    } catch {
      // Ignore storage failures; filters still work for this visit.
    }
  }, [state]);

  const setPeopleFilters = useCallback((filters: PeopleFilterValue) => {
    setState((prev) => ({ ...prev, peopleFilters: filters }));
  }, []);

  const setCategoryFilters = useCallback((filters: CategoryFilterValue) => {
    setState((prev) => ({ ...prev, categoryFilters: filters }));
  }, []);

  /** Setting explicit dates switches to the "custom" preset. */
  const setDateRange = useCallback((range: DateRange) => {
    setState((prev) => ({ ...prev, dateRange: range, datePreset: "custom" }));
  }, []);

  const setDatePreset = useCallback((preset: DatePreset) => {
    setState((prev) => ({ ...prev, datePreset: preset }));
  }, []);

  /** Clears people and category filters; the period is left alone. */
  const resetFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      peopleFilters: EMPTY_PEOPLE_FILTERS,
      categoryFilters: EMPTY_CATEGORY_FILTERS,
    }));
  }, []);

  return {
    peopleFilters: state.peopleFilters,
    categoryFilters: state.categoryFilters,
    dateRange: state.dateRange,
    datePreset: state.datePreset,
    setPeopleFilters,
    setCategoryFilters,
    setDateRange,
    setDatePreset,
    resetFilters,
  };
};
