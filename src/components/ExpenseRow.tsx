import type { Expense } from "@/lib/db";
import { formatDayLabel, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";

interface ExpenseRowProps {
  expense: Expense;
  /** Display name for a person ("You" for the current user). */
  labelOf: (id: string) => string;
  onSelect?: (expense: Expense) => void;
  /** Hide the date when rows are already grouped by day. */
  showDate?: boolean;
  className?: string;
}

/** One expense: what, who paid, how it splits, how much. Click to edit. */
export const ExpenseRow = ({ expense, labelOf, onSelect, showDate = true, className }: ExpenseRowProps) => {
  const people = expense.expense_splits.length;
  const each = people > 0 ? expense.amount / people : 0;
  const payer = labelOf(expense.paid_by);
  const content = (
    <>
      <CategoryIcon name={expense.categories?.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{expense.title}</span>
          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(expense.amount)}</span>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
          <span className="truncate">
            {payer} paid
            {people > 0 && (
              <>
                {" · "}
                {people === 1 ? "1 person" : `${people} people`}
                <span className="hidden sm:inline"> · {formatMoney(each)} each</span>
              </>
            )}
            {people === 0 && " · not split"}
          </span>
          {showDate && <span className="shrink-0 tabular-nums">{formatDayLabel(expense.date)}</span>}
        </div>
      </div>
    </>
  );

  if (!onSelect) {
    return <div className={cn("flex items-center gap-3 py-3", className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(expense)}
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {content}
    </button>
  );
};
