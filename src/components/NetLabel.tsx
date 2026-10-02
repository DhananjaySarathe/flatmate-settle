import { cn } from "@/lib/utils";
import { formatMoney, isZero } from "@/lib/format";

interface NetLabelProps {
  /** paid − share: positive gets money back, negative owes. */
  value: number;
  /** Conjugate for "you" ("you get back" rather than "gets back"). */
  isMe?: boolean;
  className?: string;
}

/** The one way a balance is put into words across the app. */
export const NetLabel = ({ value, isMe, className }: NetLabelProps) => {
  if (isZero(value)) {
    return <span className={cn("text-muted-foreground", className)}>settled up</span>;
  }
  if (value > 0) {
    return (
      <span className={cn("text-positive", className)}>
        {isMe ? "get back" : "gets back"} <span className="font-semibold tabular-nums">{formatMoney(value)}</span>
      </span>
    );
  }
  return (
    <span className={cn("text-negative", className)}>
      {isMe ? "owe" : "owes"} <span className="font-semibold tabular-nums">{formatMoney(-value)}</span>
    </span>
  );
};
