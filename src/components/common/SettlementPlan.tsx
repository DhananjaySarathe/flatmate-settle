import { CircleCheck } from "lucide-react";
import type { Settlement } from "@/lib/settlement";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { Amount } from "@/components/common/Amount";
import { cn } from "@/lib/utils";

interface SettlementPlanProps {
  settlements: Settlement[];
  /** Shown when nobody needs to pay anyone. */
  settledTitle?: string;
  settledDescription?: string;
  className?: string;
  /** Limit rows (e.g. on Home); the rest are summarised. */
  limit?: number;
}

/** "Aarav pays Diya ₹1,250.00" rows: the fewest payments that settle everyone. */
export const SettlementPlan = ({
  settlements,
  settledTitle = "All settled up",
  settledDescription = "Nobody owes anybody for this period.",
  className,
  limit,
}: SettlementPlanProps) => {
  if (settlements.length === 0) {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg bg-credit-soft px-4 py-3.5", className)}>
        <CircleCheck className="h-5 w-5 shrink-0 text-credit" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-credit">{settledTitle}</p>
          <p className="text-sm text-foreground/70">{settledDescription}</p>
        </div>
      </div>
    );
  }

  const shown = limit ? settlements.slice(0, limit) : settlements;
  const hidden = settlements.length - shown.length;

  return (
    <div className={className}>
      <ol className="divide-y divide-border/70">
        {shown.map((s, index) => (
          <li key={`${s.from}-${s.to}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex shrink-0 items-center -space-x-1.5">
              <PersonAvatar name={s.from} size="sm" className="ring-2 ring-card" />
              <PersonAvatar name={s.to} size="sm" className="ring-2 ring-card" />
            </div>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <span className="font-semibold">{s.from}</span>{" "}
              <span className="text-muted-foreground">pays</span>{" "}
              <span className="font-semibold">{s.to}</span>
            </p>
            <Amount value={s.amount} className="text-base font-semibold" />
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <p className="pt-3 text-sm text-muted-foreground">
          +{hidden} more payment{hidden === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
};
