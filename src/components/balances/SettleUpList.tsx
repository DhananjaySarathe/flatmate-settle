import { ArrowRight, PartyPopper } from "lucide-react";
import type { Settlement } from "@/lib/settlement";
import { formatMoney } from "@/lib/format";
import { PersonAvatar } from "@/components/common/PersonAvatar";

interface SettleUpListProps {
  settlements: Settlement[];
  /** Shown when nobody owes anything. */
  emptyText?: string;
}

/** "Who pays whom" — the minimum set of transfers that squares everyone up. */
export const SettleUpList = ({
  settlements,
  emptyText = "Everyone's square. No payments needed.",
}: SettleUpListProps) => {
  if (settlements.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
        <PartyPopper className="h-5 w-5 shrink-0" />
        <span className="font-medium">{emptyText}</span>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {settlements.map((s, i) => (
        <li key={`${s.from}-${s.to}-${i}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex shrink-0 items-center gap-1">
            <PersonAvatar name={s.from} size="sm" />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <PersonAvatar name={s.to} size="sm" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="font-semibold">{s.from}</span>
            <span className="text-muted-foreground"> pays </span>
            <span className="font-semibold">{s.to}</span>
          </p>
          <span className="shrink-0 text-base font-bold tabular-nums">{formatMoney(s.amount)}</span>
        </li>
      ))}
    </ul>
  );
};
