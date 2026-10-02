import { useCallback, useEffect, useState } from "react";
import { EMPTY_CATEGORY_FILTERS, type CategoryFilterValue } from "@/lib/expenseFilters";

export type MyCostDatePreset = "all-time" | "custom" | `settlement:${string}`;

interface DateRange {
  from: Date;
  to: Date;
}

interface MyCostFiltersState {
  datePreset: MyCostDatePreset;
  dateRange: DateRange;
  /** Added later; older stored objects simply don't have it. */
  categoryFilters: CategoryFilterValue;
}

const STORAGE_KEY = "myCostFilters";

const defaultDateRange = (): DateRange => ({
  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  to: new Date(),
});

const defaultState = (): MyCostFiltersState => ({
  datePreset: "all-time",
  dateRange: defaultDateRange(),
  categoryFilters: EMPTY_CATEGORY_FILTERS,
});

const isPreset = (value: unknown): value is MyCostDatePreset =>
  value === "all-time" ||
  value === "custom" ||
  (typeof value === "string" && value.startsWith("settlement:") && value.length > "settlement:".length);

const toDate = (value: unknown, fallback: Date) => {
  const d = typeof value === "string" ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};

const toIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

const loadState = (): MyCostFiltersState => {
  const fallback = defaultState();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return {
      datePreset: isPreset(parsed?.datePreset) ? parsed.datePreset : fallback.datePreset,
      dateRange: {
        from: toDate(parsed?.dateRange?.from, fallback.dateRange.from),
        to: toDate(parsed?.dateRange?.to, fallback.dateRange.to),
      },
      categoryFilters: {
        include: toIds(parsed?.categoryFilters?.include),
        exclude: toIds(parsed?.categoryFilters?.exclude),
      },
    };
  } catch (error) {
    console.error("Error parsing my cost filters:", error);
    return fallback;
  }
};

/** Period and category filters for Insights › Cost per person, persisted per browser. */
export const useMyCostFilters = () => {
  const [state, setState] = useState<MyCostFiltersState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          datePreset: state.datePreset,
          dateRange: {
            from: state.dateRange.from.toISOString(),
            to: state.dateRange.to.toISOString(),
          },
          categoryFilters: state.categoryFilters,
        })
      );
    } catch {
      // Storage can be blocked (private mode); filters still work for this visit.
    }
  }, [state]);

  const setDatePreset = useCallback((preset: MyCostDatePreset) => {
    setState((prev) => ({ ...prev, datePreset: preset }));
  }, []);

  /** Picking explicit dates switches to "custom". */
  const setDateRange = useCallback((range: DateRange) => {
    setState((prev) => ({ ...prev, dateRange: range, datePreset: "custom" }));
  }, []);

  const applySettlementRange = useCallback((settlementId: string, from: Date, to: Date) => {
    setState((prev) => ({
      ...prev,
      datePreset: `settlement:${settlementId}`,
      dateRange: { from, to },
    }));
  }, []);

  /** Back to all time; category filters are left alone. */
  const resetDateFilters = useCallback(() => {
    setState((prev) => ({ ...prev, datePreset: "all-time", dateRange: defaultDateRange() }));
  }, []);

  const setCategoryFilters = useCallback((filters: CategoryFilterValue) => {
    setState((prev) => ({ ...prev, categoryFilters: filters }));
  }, []);

  return {
    datePreset: state.datePreset,
    dateRange: state.dateRange,
    categoryFilters: state.categoryFilters,
    setDatePreset,
    setDateRange,
    applySettlementRange,
    resetDateFilters,
    setCategoryFilters,
  };
};
