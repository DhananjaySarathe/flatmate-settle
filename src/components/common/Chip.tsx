import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected?: boolean;
  /** "primary" for single-choice selections, "neutral" for filters, "danger" for hide/exclude. */
  tone?: "primary" | "neutral" | "danger";
  leading?: React.ReactNode;
  showCheck?: boolean;
  children: React.ReactNode;
}

/** A pressable pill used for people, categories and filters. 40px tall for touch. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ selected = false, tone = "primary", leading, showCheck = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "disabled:pointer-events-none disabled:opacity-50",
        leading && "pl-1.5",
        !selected && "border-border bg-card text-foreground hover:border-foreground/25 hover:bg-secondary",
        selected && tone === "primary" && "border-primary bg-primary/10 text-primary",
        selected && tone === "neutral" && "border-foreground bg-foreground text-background",
        selected && tone === "danger" && "border-debit bg-debit-soft text-debit",
        className
      )}
      {...props}
    >
      {leading}
      <span className="truncate">{children}</span>
      {showCheck && selected && <Check className="-mr-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    </button>
  )
);
Chip.displayName = "Chip";
