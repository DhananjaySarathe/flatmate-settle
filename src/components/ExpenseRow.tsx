import { ChevronRight } from "lucide-react";
import { PersonAvatar } from "@/components/PersonAvatar";
import { formatMoney, formatRelativeDay, listNames } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ExpenseRowData {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  categories?: { name: string } | null;
  flatmates?: { name: string } | null;
  expense_splits: { flatmate_id: string }[];
}

interface ExpenseRowProps {
  expense: ExpenseRowData;
  names: Map<string, string>;
  /** Number of people in the space, to say "everyone" instead of a count. */
  peopleCount: number;
  onSelect?: () => void;
  /** Under the amount: the per-person share (default) or the date. */
  aside?: "each" | "date";
}

const splitSummary = (
  expense: ExpenseRowData,
  names: Map<string, string>,
  peopleCount: number
) => {
  const ids = expense.expense_splits.map((s) => s.flatmate_id);
  const splitNames = ids.map((id) => names.get(id) ?? "Someone");
  if (ids.length === 0) return { short: "paid", full: "Not split with anyone" };
  if (ids.length === 1) {
    const only = splitNames[0];
    return ids[0] === expense.paid_by
      ? { short: "paid · personal", full: `Only for ${only}` }
      : { short: `paid for ${only}`, full: `Only for ${only}` };
  }
  if (peopleCount > 1 && ids.length === peopleCount) {
    return { short: "paid for everyone", full: `Split between ${listNames(splitNames)}` };
  }
  return { short: `paid for ${ids.length} people`, full: `Split between ${listNames(splitNames)}` };
};

export const ExpenseRow = ({ expense, names, peopleCount, onSelect, aside = "each" }: ExpenseRowProps) => {
  const payer = names.get(expense.paid_by) ?? expense.flatmates?.name ?? "Someone";
  const splitCount = expense.expense_splits.length;
  const each = splitCount > 0 ? expense.amount / splitCount : null;
  const split = splitSummary(expense, names, peopleCount);

  const body = (
    <>
      <PersonAvatar name={payer} seed={expense.paid_by} size="md" className="mt-0.5 sm:mt-0" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{expense.title}</span>
          {expense.categories?.name && (
            <span className="hidden shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
              {expense.categories.name}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground sm:truncate" title={split.full}>
          <span className="text-foreground/80">{payer}</span> {split.short}
          {aside === "each" && <span className="hidden sm:inline"> · {formatRelativeDay(expense.date)}</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className="money font-semibold">{formatMoney(expense.amount, { compact: true })}</div>
        {aside === "date" ? (
          <div className="text-xs text-muted-foreground">{formatRelativeDay(expense.date)}</div>
        ) : (
          each !== null &&
          splitCount > 1 && (
            <div className="money text-xs text-muted-foreground">{formatMoney(each, { compact: true })} each</div>
          )
        )}
      </div>
    </>
  );

  if (!onSelect) {
    return <div className="flex items-start gap-3 py-3 sm:items-center">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors sm:items-center",
        "hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={`${expense.title}, ${formatMoney(expense.amount)}, paid by ${payer}. Edit`}
    >
      {body}
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block" />
    </button>
  );
};
