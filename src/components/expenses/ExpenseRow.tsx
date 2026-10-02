import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { formatMoney, parseDay } from "@/lib/format";
import type { SpaceExpense } from "@/hooks/useSpaceData";

interface ExpenseRowProps {
  expense: SpaceExpense;
  nameOf: (flatmateId: string) => string;
  onSelect?: (expense: SpaceExpense) => void;
  showDate?: boolean;
}

/** One tappable expense line: who paid, what for, how it splits. */
export const ExpenseRow = ({ expense, nameOf, onSelect, showDate = true }: ExpenseRowProps) => {
  const payer = nameOf(expense.paid_by);
  const count = expense.expense_splits.length;
  const each = count > 0 ? expense.amount / count : 0;
  const splitNames = expense.expense_splits.map((s) => nameOf(s.flatmate_id));

  const content = (
    <>
      <PersonAvatar name={payer} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{expense.title}</p>
          {expense.categories?.name && (
            <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
              {expense.categories.name}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground sm:text-sm" title={splitNames.join(", ")}>
          <span className="font-medium text-foreground/80">{payer}</span> paid
          {showDate && <> · {format(parseDay(expense.date), "d MMM")}</>}
          {" · "}
          {count === 0 ? "no split" : count === 1 ? `for ${splitNames[0]}` : `split ${count} ways`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
        {count > 1 && (
          <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(each)} each</p>
        )}
      </div>
      {onSelect && <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 sm:block" />}
    </>
  );

  if (!onSelect) {
    return <div className="flex items-center gap-3 py-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(expense)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Edit ${expense.title}, ${formatMoney(expense.amount)} paid by ${payer}`}
    >
      {content}
    </button>
  );
};
