import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:mb-8", className)}>
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[28px]">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

/** White panel with an optional title row — the one container used across pages. */
export const Panel = ({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section className={cn("rounded-xl border bg-card shadow-card", className)}>
    {(title || actions) && (
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-5">
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    )}
    <div className={cn("px-4 pb-4 pt-3 sm:px-5", bodyClassName)}>{children}</div>
  </section>
);

export const SkeletonRows = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-secondary" />
        <span className="h-4 flex-1 animate-pulse rounded bg-secondary" style={{ maxWidth: `${70 - i * 8}%` }} />
        <span className="h-4 w-16 animate-pulse rounded bg-secondary" />
      </div>
    ))}
  </div>
);
