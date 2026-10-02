import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SplitSpaceSelectorProps {
  /** "sidebar": full-width block with a second line; "compact": a single line for the phone top bar. */
  variant?: "sidebar" | "compact";
  className?: string;
}

const SpaceMark = ({ name, className }: { name: string; className?: string }) => (
  <span
    aria-hidden
    className={cn(
      "grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary",
      className
    )}
  >
    {name.trim()[0]?.toUpperCase() ?? "S"}
  </span>
);

/** Switch between spaces; each one keeps its own people, expenses and settled periods. */
export const SplitSpaceSelector = ({ variant = "sidebar", className }: SplitSpaceSelectorProps) => {
  const { selectedSplitSpace, splitSpaces, setSelectedSplitSpace, loading } = useSplitSpace();
  const navigate = useNavigate();

  if (loading) {
    return <Skeleton className={cn(variant === "sidebar" ? "h-12 w-full" : "h-8 w-32", className)} />;
  }

  if (splitSpaces.length === 0) {
    return (
      <Button variant="outline" size="sm" asChild className={className}>
        <Link to="/split-spaces">
          <Plus />
          Create a space
        </Link>
      </Button>
    );
  }

  const current = selectedSplitSpace?.name ?? "Choose a space";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex min-w-0 items-center gap-2.5 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "sidebar"
            ? "w-full border border-border/80 bg-card px-2.5 py-2 hover:border-foreground/20"
            : "-ml-1.5 px-1.5 py-1 hover:bg-secondary",
          className
        )}
      >
        {variant === "sidebar" && <SpaceMark name={current} />}
        <span className="min-w-0 flex-1">
          {variant === "sidebar" && <span className="block text-xs text-muted-foreground">Space</span>}
          <span className={cn("block truncate font-semibold", variant === "compact" && "text-base")}>{current}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Switch space</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Your spaces</DropdownMenuLabel>
        {splitSpaces.map((space) => (
          <DropdownMenuItem
            key={space.id}
            onSelect={() => setSelectedSplitSpace(space)}
            className="gap-2.5 py-2"
          >
            <SpaceMark name={space.name} className="size-6 rounded-md text-xs" />
            <span className="flex-1 truncate">{space.name}</span>
            {space.id === selectedSplitSpace?.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/split-spaces?new=1")} className="gap-2.5">
          <Plus className="size-4" />
          New space
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/split-spaces")} className="gap-2.5">
          <Settings2 className="size-4" />
          Manage spaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
