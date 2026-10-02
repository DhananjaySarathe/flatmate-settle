import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { cn } from "@/lib/utils";

/** Shows which group (split space) you're in and switches between them. */
export const SpaceSwitcher = ({ className }: { className?: string }) => {
  const { selectedSplitSpace, splitSpaces, setSelectedSplitSpace, loading } = useSplitSpace();
  const navigate = useNavigate();
  // "New group" moves focus to the create field; don't let the menu pull it back to the trigger.
  const skipFocusReturn = useRef(false);

  if (loading) {
    return <Skeleton className={cn("h-9 w-36", className)} />;
  }

  if (splitSpaces.length === 0) {
    return (
      <button
        type="button"
        onClick={() => navigate("/split-spaces", { state: { create: true } })}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
          className
        )}
      >
        <Plus className="h-4 w-4" /> New group
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-secondary",
          className
        )}
        aria-label={`Group: ${selectedSplitSpace?.name ?? "none selected"}. Switch group`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {(selectedSplitSpace?.name ?? "?").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">
          {selectedSplitSpace?.name ?? "Choose a group"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64"
        onCloseAutoFocus={(event) => {
          if (skipFocusReturn.current) {
            event.preventDefault();
            skipFocusReturn.current = false;
          }
        }}
      >
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Your groups</DropdownMenuLabel>
        {splitSpaces.map((space) => {
          const active = space.id === selectedSplitSpace?.id;
          return (
            <DropdownMenuItem
              key={space.id}
              onSelect={() => setSelectedSplitSpace(space)}
              className="gap-2 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold">
                {space.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
              {active && <Check className="h-4 w-4 text-primary" aria-label="Current" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 py-2"
          onSelect={() => {
            skipFocusReturn.current = true;
            navigate("/split-spaces", { state: { create: true } });
          }}
        >
          <Plus className="h-4 w-4" /> New group
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2" onSelect={() => navigate("/split-spaces")}>
          <Settings2 className="h-4 w-4" /> Manage groups
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
