import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SplitSpaceSelectorProps {
  /** "full" fills its container (sidebar); "compact" sizes to content (mobile top bar). */
  variant?: "full" | "compact";
}

export const SplitSpaceSelector = ({ variant = "full" }: SplitSpaceSelectorProps) => {
  const { selectedSplitSpace, splitSpaces, setSelectedSplitSpace, loading } = useSplitSpace();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        className={cn(
          "h-10 animate-pulse rounded-lg bg-secondary",
          variant === "full" ? "w-full" : "w-32"
        )}
        aria-label="Loading spaces"
      />
    );
  }

  if (splitSpaces.length === 0) {
    return (
      <button
        type="button"
        onClick={() => navigate("/split-spaces")}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Create a space
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm shadow-card transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-foreground/25",
          variant === "full" ? "w-full" : "max-w-[60vw]"
        )}
        aria-label={`Current space: ${selectedSplitSpace?.name ?? "none"}. Switch space`}
      >
        <span className="min-w-0 flex-1">
          {variant === "full" && (
            <span className="block text-[11px] leading-none text-muted-foreground">Space</span>
          )}
          <span className="block truncate font-medium leading-tight">
            {selectedSplitSpace?.name || "Select a space"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Switch space
        </DropdownMenuLabel>
        {splitSpaces.map((space) => {
          const active = space.id === selectedSplitSpace?.id;
          return (
            <DropdownMenuItem
              key={space.id}
              onSelect={() => setSelectedSplitSpace(space)}
              className="gap-2"
            >
              <Check className={cn("h-4 w-4", active ? "opacity-100 text-primary" : "opacity-0")} />
              <span className="truncate">{space.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/split-spaces")} className="gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Manage spaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
