import { forwardRef, ButtonHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChoiceChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  /** Show a check mark when selected (multi-select groups). */
  check?: boolean;
  tone?: "primary" | "negative";
}

/**
 * Pill toggle used for "paid by", "split between", categories and filters. Selection is
 * drawn in ink, so terracotta stays reserved for the primary action on the same screen.
 */
export const ChoiceChip = forwardRef<HTMLButtonElement, ChoiceChipProps>(
  ({ selected, check, tone = "primary", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        selected
          ? tone === "negative"
            ? "border-negative bg-negative/10 text-negative ring-1 ring-inset ring-negative"
            : "border-foreground/80 bg-secondary text-foreground ring-1 ring-inset ring-foreground/80"
          : "border-border bg-card text-foreground hover:border-foreground/25 hover:bg-secondary/60",
        className
      )}
      {...props}
    >
      {check && selected && <Check className="size-3.5 shrink-0" strokeWidth={2.5} />}
      {children}
    </button>
  )
);
ChoiceChip.displayName = "ChoiceChip";
