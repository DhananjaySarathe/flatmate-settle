import { useState, useEffect } from "react";

interface PeopleFilters {
  exactMatch: string[];
  anyMatch: string[];
  exclude: string[];
  paidBy: string[];
}

interface CategoryFilters {
  include: string[];
  exclude: string[];
}

interface DateRange {
  from: Date;
  to: Date;
}

interface ReportFiltersState {
  peopleFilters: PeopleFilters;
  categoryFilters: CategoryFilters;
  dateRange: DateRange;
}

const STORAGE_KEY = "reportFilters";

const defaultState: ReportFiltersState = {
  peopleFilters: {
    exactMatch: [],
    anyMatch: [],
    exclude: [],
    paidBy: [],
  },
  categoryFilters: {
    include: [],
    exclude: [],
  },
  dateRange: {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  },
};

export const useReportFilters = () => {
  const [state, setState] = useState<ReportFiltersState>(() => {
    // Load from localStorage on init
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            peopleFilters: parsed.peopleFilters || defaultState.peopleFilters,
            categoryFilters: parsed.categoryFilters || defaultState.categoryFilters,
            dateRange: {
              from: parsed.dateRange?.from ? new Date(parsed.dateRange.from) : defaultState.dateRange.from,
              to: parsed.dateRange?.to ? new Date(parsed.dateRange.to) : defaultState.dateRange.to,
            },
          };
        } catch (error) {
          console.error("Error parsing stored filters:", error);
        }
      }
    }
    return defaultState;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const toStore = {
        peopleFilters: state.peopleFilters,
        categoryFilters: state.categoryFilters,
        dateRange: {
          from: state.dateRange.from.toISOString(),
          to: state.dateRange.to.toISOString(),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    }
  }, [state]);

  const setPeopleFilters = (filters: PeopleFilters) => {
    setState((prev) => ({ ...prev, peopleFilters: filters }));
  };

  const setCategoryFilters = (filters: CategoryFilters) => {
    setState((prev) => ({ ...prev, categoryFilters: filters }));
  };

  const setDateRange = (range: DateRange) => {
    setState((prev) => ({ ...prev, dateRange: range }));
  };

  const resetFilters = () => {
    setState(defaultState);
  };

  return {
    peopleFilters: state.peopleFilters,
    categoryFilters: state.categoryFilters,
    dateRange: state.dateRange,
    setPeopleFilters,
    setCategoryFilters,
    setDateRange,
    resetFilters,
  };
};

