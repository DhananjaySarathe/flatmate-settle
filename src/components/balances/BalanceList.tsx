import type { Balance } from "@/lib/settlement";
import { formatMoney } from "@/lib/format";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { cn } from "@/lib/utils";

const EPS = 0.01;

/**
 * Net position per person. Positive = paid more than their share (gets money
 * back); negative = paid less (owes). Bars are scaled to the largest balance.
 */
export const BalanceList = ({ balances, showDetail = true }: { balances: Balance[]; showDetail?: boolean }) => {
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  const max = Math.max(...sorted.map((b) => Math.abs(b.balance)), EPS);

  return (
    <ul className="space-y-3">
      {sorted.map((b) => {
        const pos = b.balance > EPS;
        const neg = b.balance < -EPS;
        const pct = Math.min(100, (Math.abs(b.balance) / max) * 100);
        return (
          <li key={b.id} className="flex items-center gap-3">
            <PersonAvatar name={b.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{b.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    pos && "text-success",
                    neg && "text-destructive",
                    !pos && !neg && "text-muted-foreground"
                  )}
                >
                  {pos ? `gets back ${formatMoney(b.balance)}` : neg ? `owes ${formatMoney(-b.balance)}` : "settled up"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", pos ? "bg-success" : neg ? "bg-destructive/80" : "bg-transparent")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {showDetail && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Paid {formatMoney(b.totalPaid)} · share {formatMoney(b.totalOwed)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
