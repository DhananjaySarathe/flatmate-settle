import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center text-center",
      compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12",
      className
    )}
  >
    {Icon && (
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    )}
    <p className="text-base font-semibold text-foreground">{title}</p>
    {description && (
      <div className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</div>
    )}
    {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);
