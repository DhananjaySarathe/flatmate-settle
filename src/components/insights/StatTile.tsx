import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}

/** One headline number. Render inside a <dl> grid. */
export const StatTile = ({ label, value, sub, className }: StatTileProps) => (
  <div className={cn("min-w-0 rounded-xl border bg-card p-4 shadow-card sm:p-5", className)}>
    <dt className="truncate text-[13px] font-medium text-muted-foreground">{label}</dt>
    <dd
      className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl"
      title={typeof value === "string" ? value : undefined}
    >
      {value}
    </dd>
    {sub && <dd className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">{sub}</dd>}
  </div>
);
