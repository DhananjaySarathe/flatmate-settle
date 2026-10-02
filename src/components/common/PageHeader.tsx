import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {description && <div className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** A titled block within a page. Not a card: just a heading, an optional action and content. */
export const Section = ({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) => (
  <section className={cn("space-y-3", className)} aria-labelledby={id}>
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </section>
);

/** The one surface style used for grouped content. */
export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-xl border bg-card p-4 shadow-card sm:p-5", className)}>{children}</div>
);
