import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry: () => void;
  className?: string;
}

/** Shown instead of numbers when a fetch fails. Never show balances from a failed load. */
export const ErrorState = ({
  title = "Couldn't load this group",
  description = "Check your connection and try again.",
  onRetry,
  className,
}: ErrorStateProps) => (
  <EmptyState
    icon={WifiOff}
    title={title}
    description={description}
    className={className}
    action={
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw /> Try again
      </Button>
    }
  />
);
