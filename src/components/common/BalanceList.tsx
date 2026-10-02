import type { Balance } from "@/lib/settlement";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { balanceStatus, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BalanceListProps {
  balances: Balance[];
  /** Hide the "Paid · Share" breakdown line. */
  compact?: boolean;
  /** Makes each row a button, e.g. to open that person's details. */
  onSelect?: (balance: Balance) => void;
  className?: string;
}

/**
 * One row per person: what they paid, their share, and the net result in
 * plain words. Net = paid − share (src/lib/settlement.ts).
 */
export const BalanceList = ({
  balances,
  compact = false,
  onSelect,
  className,
}: BalanceListProps) => (
  <ul className={cn("divide-y divide-border/70", className)}>
    {balances.map((b) => {
      const status = balanceStatus(b.balance);
      const idle = b.totalPaid < 0.005 && b.totalOwed < 0.005;
      const Row = onSelect ? "button" : "div";
      return (
        <li key={b.id}>
          <Row
            {...(onSelect
              ? {
                  type: "button" as const,
                  onClick: () => onSelect(b),
                  "aria-label": `${b.name}: ${
                    status === "settled"
                      ? idle
                        ? "not in any expense this period"
                        : "settled up"
                      : `${status === "gets-back" ? "gets back" : "owes"} ${formatMoney(Math.abs(b.balance))}`
                  }. Show details`,
                }
              : {})}
            className={cn(
              "flex w-full items-center gap-3 py-3 text-left",
              onSelect &&
                "-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 transition-colors hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <PersonAvatar name={b.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.name}</p>
              {!compact && idle && (
                <p className="text-xs leading-snug text-muted-foreground">Not in any expense this period</p>
              )}
              {!compact && !idle && (
                <p className="text-xs leading-snug text-muted-foreground tabular-nums">
                  <span className="whitespace-nowrap">Paid {formatMoney(b.totalPaid)}</span> ·{" "}
                  <span className="whitespace-nowrap">Share {formatMoney(b.totalOwed)}</span>
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {status === "settled" ? (
                <p className="text-sm font-medium text-muted-foreground">{idle ? "—" : "Settled up"}</p>
              ) : (
                <>
                  <p
                    className={cn(
                      "text-[11px] font-medium leading-none",
                      status === "gets-back" ? "text-credit" : "text-debit"
                    )}
                  >
                    {status === "gets-back" ? "gets back" : "owes"}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-base font-semibold tabular-nums",
                      status === "gets-back" ? "text-credit" : "text-debit"
                    )}
                  >
                    {formatMoney(Math.abs(b.balance))}
                  </p>
                </>
              )}
            </div>
          </Row>
        </li>
      );
    })}
  </ul>
);
