export interface Flatmate {
  id: string;
  name: string;
  email?: string | null;
}

export interface ExpenseLike {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  categories?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

export interface Balance {
  id: string;
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export const calculateBalances = (
  flatmates: Flatmate[],
  expenses: ExpenseLike[]
): Balance[] => {
  const balanceMap = new Map<string, Balance>();

  flatmates.forEach((flatmate) => {
    balanceMap.set(flatmate.id, {
      id: flatmate.id,
      name: flatmate.name,
      totalPaid: 0,
      totalOwed: 0,
      balance: 0,
    });
  });

  expenses.forEach((expense) => {
    const paidByBalance = balanceMap.get(expense.paid_by);
    if (paidByBalance) {
      paidByBalance.totalPaid += expense.amount;
    }

    if (expense.expense_splits.length === 0) return;
    const splitAmount = expense.amount / expense.expense_splits.length;

    expense.expense_splits.forEach((split) => {
      const owedBalance = balanceMap.get(split.flatmate_id);
      if (owedBalance) {
        owedBalance.totalOwed += splitAmount;
      }
    });
  });

  balanceMap.forEach((balance) => {
    balance.balance = balance.totalPaid - balance.totalOwed;
  });

  return Array.from(balanceMap.values());
};

export const calculateSettlements = (balances: Balance[]): Settlement[] => {
  const settlements: Settlement[] = [];
  const balancesCopy = balances.map((b) => ({ ...b })).sort((a, b) => b.balance - a.balance);

  let i = 0;
  let j = balancesCopy.length - 1;

  while (i < j) {
    const debtor = balancesCopy[j];
    const creditor = balancesCopy[i];

    if (Math.abs(debtor.balance) < 0.01 && Math.abs(creditor.balance) < 0.01) {
      break;
    }

    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    if (amount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });
      debtor.balance += amount;
      creditor.balance -= amount;
    }

    if (Math.abs(debtor.balance) < 0.01) j--;
    if (creditor.balance < 0.01) i++;
  }

  return settlements;
};

export type SnapshotStatus = "owes" | "needs" | "settled";

export interface SnapshotBalance {
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
  status: SnapshotStatus;
}

export interface SnapshotExpense {
  date: string;
  title: string;
  paidBy: string;
  splitBetween: string[];
  amount: number;
  perPerson: number;
  category?: string;
}

export interface ReportSnapshot {
  generatedAt: string;
  splitSpaceName: string;
  dateRange: { from: string; to: string };
  balances: SnapshotBalance[];
  settlements: Settlement[];
  expenses: SnapshotExpense[];
}

const statusOf = (balance: number): SnapshotStatus => {
  if (Math.abs(balance) < 0.01) return "settled";
  return balance > 0 ? "owes" : "needs";
};

export interface BuildSnapshotInput {
  splitSpaceName: string;
  dateRange: { from: string; to: string };
  balances: Balance[];
  settlements: Settlement[];
  expenses: ExpenseLike[];
  flatmates: Flatmate[];
}

export const buildShareSnapshot = ({
  splitSpaceName,
  dateRange,
  balances,
  settlements,
  expenses,
  flatmates,
}: BuildSnapshotInput): ReportSnapshot => {
  const flatmateById = new Map(flatmates.map((f) => [f.id, f.name]));

  return {
    generatedAt: new Date().toISOString(),
    splitSpaceName,
    dateRange,
    balances: balances.map((b) => ({
      name: b.name,
      totalPaid: b.totalPaid,
      totalOwed: b.totalOwed,
      balance: b.balance,
      status: statusOf(b.balance),
    })),
    settlements,
    expenses: expenses.map((e) => ({
      date: e.date,
      title: e.title,
      paidBy: flatmateById.get(e.paid_by) ?? "Unknown",
      splitBetween: e.expense_splits.map(
        (s) => flatmateById.get(s.flatmate_id) ?? "Unknown"
      ),
      amount: e.amount,
      perPerson: e.expense_splits.length > 0 ? e.amount / e.expense_splits.length : 0,
      category: e.categories?.name,
    })),
  };
};
