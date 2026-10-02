import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const SplitSpaceSelector = () => {
  const { selectedSplitSpace, splitSpaces, setSelectedSplitSpace, loading } = useSplitSpace();
  const navigate = useNavigate();

  if (loading) {
    return <div className="h-9 w-32 animate-pulse rounded-md bg-muted" aria-label="Loading SplitSpaces" />;
  }

  if (splitSpaces.length === 0) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate("/split-spaces")} className="gap-2">
        <Plus className="h-4 w-4" />
        Create SplitSpace
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 max-w-full justify-between gap-2 border-border/70 bg-background/60 px-3 md:max-w-[220px]"
          aria-label="Switch SplitSpace"
        >
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{selectedSplitSpace?.name || "Select SplitSpace"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">SplitSpaces</DropdownMenuLabel>
        {splitSpaces.map((space) => (
          <DropdownMenuItem key={space.id} onSelect={() => setSelectedSplitSpace(space)}>
            <span className="flex-1 truncate">{space.name}</span>
            {space.id === selectedSplitSpace?.id && <Check className="ml-2 h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/split-spaces")}>
          <Plus className="mr-2 h-4 w-4" />
          New or manage…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
