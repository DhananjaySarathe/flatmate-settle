/**
 * Pure calculations behind the three Insights pages. Kept out of the page
 * components so the screens and their PDFs always use the same numbers.
 */

interface MathExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string | null;
  categories?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

interface MathPerson {
  id: string;
  name: string;
}

export const sumAmounts = (expenses: { amount: number }[]) =>
  expenses.reduce((sum, e) => sum + e.amount, 0);

/** "34%", "<1%" for slivers, "0%" for nothing. */
export const formatPercent = (value: number) =>
  value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%`;

// ---------------------------------------------------------------- Spending

export const NO_CATEGORY_ID = "__no-category__";

export interface CategoryTotal {
  id: string;
  name: string;
  total: number;
  /** Share of all spending in the list, 0–100. */
  percentage: number;
  count: number;
  /** The bucket for expenses saved without a category. */
  uncategorised: boolean;
}

/**
 * Totals per category, biggest first. Expenses without a category get their
 * own "No category" bucket so the percentages always add up to 100%.
 */
export const categoryBreakdown = (
  expenses: MathExpense[],
  categories: { id: string; name: string }[]
): CategoryTotal[] => {
  const grandTotal = sumAmounts(expenses);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const rows = new Map<string, CategoryTotal>();

  for (const expense of expenses) {
    const id = expense.category_id || NO_CATEGORY_ID;
    let row = rows.get(id);
    if (!row) {
      row = {
        id,
        name: expense.category_id
          ? nameById.get(expense.category_id) ?? expense.categories?.name ?? "Unknown category"
          : "No category",
        total: 0,
        percentage: 0,
        count: 0,
        uncategorised: !expense.category_id,
      };
      rows.set(id, row);
    }
    row.total += expense.amount;
    row.count += 1;
  }

  return Array.from(rows.values())
    .map((row) => ({ ...row, percentage: grandTotal > 0 ? (row.total / grandTotal) * 100 : 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

export interface DayTotal {
  /** "yyyy-MM-dd" */
  date: string;
  total: number;
  count: number;
  /** Titles on that day, biggest first. */
  titles: string[];
}

/** The days with the most spending, biggest first. */
export const biggestDays = (expenses: MathExpense[], limit = 5): DayTotal[] => {
  const byDay = new Map<string, { total: number; items: MathExpense[] }>();
  for (const expense of expenses) {
    const day = byDay.get(expense.date) ?? { total: 0, items: [] };
    day.total += expense.amount;
    day.items.push(expense);
    byDay.set(expense.date, day);
  }
  return Array.from(byDay.entries())
    .map(([date, day]) => ({
      date,
      total: day.total,
      count: day.items.length,
      titles: [...day.items].sort((a, b) => b.amount - a.amount).map((e) => e.title),
    }))
    .sort((a, b) => b.total - a.total || b.date.localeCompare(a.date))
    .slice(0, limit);
};

// ---------------------------------------------------------- Cost per person

export interface PersonCost {
  id: string;
  name: string;
  totalCost: number;
  expenseCount: number;
}

/**
 * Each person's share of the expenses they're split on: amount ÷ number of
 * people in the split, counted once per split they're in. Same rule the
 * My Cost page has always used; expenses with nobody in the split add nothing.
 */
export const calculateCosts = (people: MathPerson[], expenses: MathExpense[]): PersonCost[] => {
  const costMap = new Map<string, PersonCost>();
  people.forEach((person) => {
    costMap.set(person.id, { id: person.id, name: person.name, totalCost: 0, expenseCount: 0 });
  });

  expenses.forEach((expense) => {
    if (expense.expense_splits.length === 0) return;
    const splitAmount = expense.amount / expense.expense_splits.length;
    expense.expense_splits.forEach((split) => {
      const personCost = costMap.get(split.flatmate_id);
      if (personCost) {
        personCost.totalCost += splitAmount;
        personCost.expenseCount += 1;
      }
    });
  });

  return [...costMap.values()].sort(
    (a, b) => b.totalCost - a.totalCost || a.name.localeCompare(b.name)
  );
};

// ------------------------------------------------------------- Leaderboard

export interface PersonStats {
  id: string;
  name: string;
  totalPaid: number;
  expenseCount: number;
  highestExpense: number;
  /** Paid per category name. */
  categoryTotals: Record<string, number>;
}

export interface CategoryLeader {
  id?: string;
  name: string;
  total: number;
}

export interface LeaderboardData {
  /** Everyone, by total paid (highest first). */
  ranked: PersonStats[];
  topPayers: PersonStats[];
  mostGenerous?: PersonStats;
  silentAssassin?: PersonStats;
  bigSpender?: PersonStats;
  milkBhai: CategoryLeader;
  fuelKing: CategoryLeader;
  foodie: CategoryLeader;
  /** False until someone in the group has paid for something. */
  hasPayments: boolean;
}

const categoryLeader = (stats: PersonStats[], categoryName: string): CategoryLeader =>
  stats.reduce<CategoryLeader>(
    (leader, person) => {
      const categoryTotal = person.categoryTotals[categoryName] || 0;
      return categoryTotal > leader.total ? { id: person.id, name: person.name, total: categoryTotal } : leader;
    },
    { name: "N/A", total: 0 }
  );

/**
 * All-time stats per person. Every sort works on a copy: the old page sorted
 * its state in place, which left the rankings ordered by biggest single expense.
 */
export const computeLeaderboard = (people: MathPerson[], expenses: MathExpense[]): LeaderboardData => {
  const stats: PersonStats[] = people.map((person) => {
    const paid = expenses.filter((e) => e.paid_by === person.id);
    const categoryTotals: Record<string, number> = {};
    paid.forEach((e) => {
      if (e.category_id && e.categories) {
        categoryTotals[e.categories.name] = (categoryTotals[e.categories.name] || 0) + e.amount;
      }
    });
    return {
      id: person.id,
      name: person.name,
      totalPaid: sumAmounts(paid),
      expenseCount: paid.length,
      // reduce, not Math.max(...spread): a long history would overflow the call stack.
      highestExpense: paid.reduce((max, e) => (e.amount > max ? e.amount : max), paid.length > 0 ? -Infinity : 0),
      categoryTotals,
    };
  });

  const ranked = [...stats].sort((a, b) => b.totalPaid - a.totalPaid || a.name.localeCompare(b.name));
  const silentAssassin = ranked
    .filter((p) => p.expenseCount > 0)
    .sort((a, b) => a.totalPaid - b.totalPaid)[0];
  const bigSpender = [...ranked].sort((a, b) => b.highestExpense - a.highestExpense)[0];

  return {
    ranked,
    topPayers: ranked.slice(0, 3),
    mostGenerous: ranked[0],
    silentAssassin,
    bigSpender,
    milkBhai: categoryLeader(ranked, "Groceries"),
    fuelKing: categoryLeader(ranked, "Fuel"),
    foodie: categoryLeader(ranked, "Food"),
    hasPayments: ranked.some((p) => p.expenseCount > 0),
  };
};
