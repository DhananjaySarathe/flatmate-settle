import { ReactNode } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  /** Plain-text title for the browser tab when `title` isn't a string. */
  documentTitle?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, documentTitle, description, actions, className }: PageHeaderProps) => {
  const tabTitle = documentTitle ?? (typeof title === "string" ? title : undefined);
  useDocumentTitle(tabTitle);
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};
