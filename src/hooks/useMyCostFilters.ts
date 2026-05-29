import { useState, useEffect } from "react";

export type MyCostDatePreset = "all-time" | "custom" | `settlement:${string}`;

interface DateRange {
  from: Date;
  to: Date;
}

interface MyCostFiltersState {
  datePreset: MyCostDatePreset;
  dateRange: DateRange;
}

const STORAGE_KEY = "myCostFilters";

const defaultDateRange = (): DateRange => ({
  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  to: new Date(),
});

const defaultState: MyCostFiltersState = {
  datePreset: "all-time",
  dateRange: defaultDateRange(),
};

export const useMyCostFilters = () => {
  const [state, setState] = useState<MyCostFiltersState>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            datePreset: parsed.datePreset || defaultState.datePreset,
            dateRange: {
              from: parsed.dateRange?.from
                ? new Date(parsed.dateRange.from)
                : defaultState.dateRange.from,
              to: parsed.dateRange?.to
                ? new Date(parsed.dateRange.to)
                : defaultState.dateRange.to,
            },
          };
        } catch (error) {
          console.error("Error parsing my cost filters:", error);
        }
      }
    }
    return defaultState;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          datePreset: state.datePreset,
          dateRange: {
            from: state.dateRange.from.toISOString(),
            to: state.dateRange.to.toISOString(),
          },
        })
      );
    }
  }, [state]);

  const setDatePreset = (preset: MyCostDatePreset) => {
    setState((prev) => ({ ...prev, datePreset: preset }));
  };

  const setDateRange = (range: DateRange) => {
    setState((prev) => ({ ...prev, dateRange: range, datePreset: "custom" }));
  };

  const applySettlementRange = (
    settlementId: string,
    from: Date,
    to: Date
  ) => {
    setState({
      datePreset: `settlement:${settlementId}`,
      dateRange: { from, to },
    });
  };

  const resetDateFilters = () => {
    setState(defaultState);
  };

  return {
    datePreset: state.datePreset,
    dateRange: state.dateRange,
    setDatePreset,
    setDateRange,
    applySettlementRange,
    resetDateFilters,
  };
};
