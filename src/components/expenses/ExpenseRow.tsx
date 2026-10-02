import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { SpaceExpense } from "@/hooks/useSpaceData";
import { describeSplit, formatMoney, parseDay } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ExpenseRowProps {
  expense: SpaceExpense;
  nameOf: (id: string) => string;
  /** Number of people in the space, to say "everyone" instead of listing names. */
  peopleCount: number;
  onOpen?: (expense: SpaceExpense) => void;
  /** Narrow columns: drop the category chip so titles stay readable. */
  compact?: boolean;
  className?: string;
}

/** One expense: what, who paid, who shares it, and what each share costs. */
export const ExpenseRow = ({ expense, nameOf, peopleCount, onOpen, compact = false, className }: ExpenseRowProps) => {
  const day = parseDay(expense.date);
  const count = expense.expense_splits.length;
  const share = count > 0 ? expense.amount / count : 0;
  const Wrapper = onOpen ? "button" : "div";

  return (
    <Wrapper
      {...(onOpen ? { type: "button" as const, onClick: () => onOpen(expense) } : {})}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:gap-4 sm:px-5",
        onOpen &&
          "hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
      aria-label={onOpen ? `${expense.title}, ${formatMoney(expense.amount)}. Show split` : undefined}
    >
      <div
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary leading-none"
        aria-hidden="true"
      >
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">{format(day, "MMM")}</span>
        <span className="mt-0.5 text-base font-bold tabular-nums">{format(day, "d")}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold sm:text-[15px]">{expense.title}</p>
          {expense.categories?.name && !compact && (
            <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
              {expense.categories.name}
            </span>
          )}
        </div>
        {count === 0 ? (
          <p className="mt-1 text-xs">
            <span className="rounded-full bg-debit-soft px-2 py-0.5 font-medium text-debit">Nobody in split</span>
            <span className="ml-1.5 text-muted-foreground">{nameOf(expense.paid_by)} is credited in full</span>
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:line-clamp-1 sm:text-sm">
            <span className="font-medium text-foreground/80">{nameOf(expense.paid_by)}</span> paid ·{" "}
            {describeSplit(expense.expense_splits.map((s) => s.flatmate_id), nameOf, peopleCount)}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums sm:text-[15px]">{formatMoney(expense.amount)}</p>
        {count > 1 && (
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatMoney(share)} each</p>
        )}
      </div>

      {onOpen && (
        <ChevronRight
          className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block"
          aria-hidden="true"
        />
      )}
    </Wrapper>
  );
};
