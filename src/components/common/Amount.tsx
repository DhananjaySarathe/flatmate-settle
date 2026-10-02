import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

interface AmountProps {
  value: number;
  /** "auto" colours by sign: positive = credit (gets back), negative = debit (owes). */
  tone?: "auto" | "credit" | "debit" | "muted" | "default";
  signed?: boolean;
  decimals?: 0 | 2;
  className?: string;
}

const SETTLED = 0.01;

export const Amount = ({
  value,
  tone = "default",
  signed = false,
  decimals = 2,
  className,
}: AmountProps) => {
  const resolved =
    tone === "auto"
      ? value > SETTLED
        ? "credit"
        : value < -SETTLED
          ? "debit"
          : "muted"
      : tone;

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        resolved === "credit" && "text-credit",
        resolved === "debit" && "text-debit",
        resolved === "muted" && "text-muted-foreground",
        className
      )}
    >
      {formatMoney(value, { signed, decimals })}
    </span>
  );
};
