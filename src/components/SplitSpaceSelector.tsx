import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const SplitSpaceSelector = () => {
  const { selectedSplitSpace, splitSpaces, setSelectedSplitSpace, loading } = useSplitSpace();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (splitSpaces.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/split-spaces")}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        <span>Create SplitSpace</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <Select
        value={selectedSplitSpace?.id || ""}
        onValueChange={(value) => {
          const splitSpace = splitSpaces.find((ss) => ss.id === value);
          if (splitSpace) {
            setSelectedSplitSpace(splitSpace);
          }
        }}
      >
        <SelectTrigger className="w-[180px] h-8">
          <SelectValue placeholder="Select SplitSpace">
            {selectedSplitSpace?.name || "Select SplitSpace"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {splitSpaces.map((splitSpace) => (
            <SelectItem key={splitSpace.id} value={splitSpace.id}>
              {splitSpace.name}
            </SelectItem>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate("/split-spaces")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Manage SplitSpaces
            </Button>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
};

