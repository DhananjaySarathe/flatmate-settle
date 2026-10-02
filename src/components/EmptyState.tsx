import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, children, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
    <span className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
    <h3 className="font-semibold">{title}</h3>
    {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{children}</div>}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);
