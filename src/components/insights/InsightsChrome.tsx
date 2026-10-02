import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Plus, Receipt, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InsightsNav } from "@/components/layout/InsightsNav";
import { useExpenseComposer } from "@/contexts/ExpenseComposerContext";
import { errorMessage } from "@/lib/db";

/** Width and rhythm shared by the three Insights pages. */
export const InsightsPage = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto max-w-5xl">{children}</div>
);

interface InsightsHeaderProps {
  onDownload: () => void;
  downloading?: boolean;
  /** Disable the PDF button while there's nothing to export yet. */
  canDownload?: boolean;
  /** One line under the tabs that says what this view counts. */
  caption?: ReactNode;
}

/** "Insights" title with the PDF action, then the Spending / Cost per person / Leaderboard tabs. */
export const InsightsHeader = ({ onDownload, downloading = false, canDownload = true, caption }: InsightsHeaderProps) => (
  <>
    <PageHeader
      title="Insights"
      className="mb-4 flex-row items-center justify-between sm:mb-5 sm:items-center"
      actions={
        <Button variant="outline" onClick={onDownload} disabled={!canDownload || downloading}>
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
          {downloading ? "Preparing PDF…" : "Download PDF"}
        </Button>
      }
    />
    <InsightsNav className={caption ? "mb-3" : undefined} />
    {caption && <p className="mb-5 text-sm text-muted-foreground">{caption}</p>}
  </>
);

/** Content-shaped placeholders while the group's data loads. */
export const InsightsSkeleton = ({ variant }: { variant: "spending" | "list" | "leaderboard" }) => {
  if (variant === "spending") {
    return (
      <div role="status" aria-busy="true" aria-label="Loading spending">
        <div className="mb-5 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl sm:h-[108px]" />
          ))}
        </div>
        <Skeleton className="mt-6 h-[220px] rounded-xl sm:h-[300px]" />
      </div>
    );
  }
  if (variant === "leaderboard") {
    return (
      <div role="status" aria-busy="true" aria-label="Loading leaderboard" className="space-y-6">
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-10 w-full rounded-md sm:w-80" />
        <Skeleton className="h-10 w-32 shrink-0 rounded-md" />
      </div>
      <Panel className="space-y-1">
        <Skeleton className="mb-3 h-4 w-3/4" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-1.5 w-full" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Panel>
    </div>
  );
};

/** Shown when no group is selected yet. */
export const InsightsNoGroup = ({ hasGroups }: { hasGroups: boolean }) => {
  const navigate = useNavigate();
  return (
    <Panel>
      <EmptyState
        icon={Users}
        title={hasGroups ? "Choose a group" : "Create your first group"}
        description={
          hasGroups
            ? "Insights are worked out for one group at a time. Pick one from the group menu at the top, or from your groups."
            : "Insights are worked out for one group at a time, like your flat or a trip."
        }
        action={
          hasGroups ? (
            <Button onClick={() => navigate("/split-spaces")}>
              <Users /> See your groups
            </Button>
          ) : (
            <Button onClick={() => navigate("/split-spaces", { state: { create: true } })}>
              <Plus /> New group
            </Button>
          )
        }
      />
    </Panel>
  );
};

export const InsightsError = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <Panel>
    <ErrorState description={errorMessage(error, "Check your connection and try again.")} onRetry={onRetry} />
  </Panel>
);

/** The group has nobody in it yet. */
export const InsightsNoPeople = () => {
  const navigate = useNavigate();
  return (
    <Panel>
      <EmptyState
        icon={UserPlus}
        title="Add people to this group first"
        description="Insights show who spent what, so they start once the people you split with are in the group."
        action={
          <Button onClick={() => navigate("/dashboard", { state: { addPerson: true } })}>
            <UserPlus /> Add people
          </Button>
        }
      />
    </Panel>
  );
};

/** People are in, but nobody has added an expense. */
export const InsightsNoExpenses = ({ title, description }: { title: string; description: string }) => {
  const { openNew } = useExpenseComposer();
  return (
    <Panel>
      <EmptyState
        icon={Receipt}
        title={title}
        description={description}
        action={
          <Button onClick={openNew}>
            <Plus /> Add expense
          </Button>
        }
      />
    </Panel>
  );
};
