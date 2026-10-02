import { ArrowRight } from "lucide-react";
import type { Balance } from "@/lib/settlement";
import type { Payment } from "@/lib/ledger";
import { formatMoney, isZero } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/PersonAvatar";
import { NetLabel } from "@/components/NetLabel";

interface NameProps {
  /** Real name for an id (avatars always use it); rows say "You" for meId. */
  nameOf: (id: string) => string;
  meId: string | null;
}

/** "Aman → Riya  ₹1,800.00" rows: the fewest payments that settle everyone. */
export const PaymentList = ({ payments, nameOf, meId, className }: NameProps & { payments: Payment[]; className?: string }) => (
  <ul className={cn("divide-y", className)}>
    {payments.map((p) => {
      const involvesMe = p.fromId === meId || p.toId === meId;
      const label = (id: string) => (id === meId ? "You" : nameOf(id));
      return (
        <li key={`${p.fromId}-${p.toId}`} className="flex items-center gap-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <PersonAvatar name={nameOf(p.fromId)} size="sm" className="hidden sm:inline-flex" />
            <span className={cn("truncate text-sm", p.fromId === meId ? "font-semibold" : "font-medium")}>
              {label(p.fromId)}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="pays" />
            <PersonAvatar name={nameOf(p.toId)} size="sm" className="hidden sm:inline-flex" />
            <span className={cn("truncate text-sm", p.toId === meId ? "font-semibold" : "font-medium")}>
              {label(p.toId)}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              involvesMe && (p.fromId === meId ? "text-negative" : "text-positive")
            )}
          >
            {formatMoney(p.amount)}
          </span>
        </li>
      );
    })}
  </ul>
);

/**
 * Everyone's position: what they paid, their share, and the net in words, with a
 * bar on a shared scale so the biggest creditor and debtor stand out at a glance.
 */
export const BalanceList = ({
  balances,
  meId,
  className,
}: Omit<NameProps, "nameOf"> & { balances: Balance[]; className?: string }) => {
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  const scale = Math.max(...sorted.map((b) => Math.abs(b.balance)), 0.01);
  return (
    <ul className={cn("divide-y", className)}>
      {sorted.map((b) => {
        const isMe = b.id === meId;
        const width = `${Math.max(Math.abs(b.balance) / scale, isZero(b.balance) ? 0 : 0.04) * 50}%`;
        return (
          <li key={b.id} className="py-3">
            <div className="flex items-center gap-3">
              <PersonAvatar name={b.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn("truncate text-sm", isMe ? "font-semibold" : "font-medium")}>
                    {isMe ? "You" : b.name}
                  </span>
                  <NetLabel value={b.balance} isMe={isMe} className="shrink-0 text-sm" />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>
                    Paid {formatMoney(b.totalPaid)} · Share {formatMoney(b.totalOwed)}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative ml-11 mt-2 h-1.5 rounded-full bg-secondary" aria-hidden>
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              {!isZero(b.balance) && (
                <span
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    b.balance > 0 ? "left-1/2 bg-positive/70" : "right-1/2 bg-negative/70"
                  )}
                  style={{ width }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
