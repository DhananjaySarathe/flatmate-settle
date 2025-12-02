import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Flatmate {
  id: string;
  name: string;
}

interface PeopleFiltersProps {
  flatmates: Flatmate[];
  onFiltersChange: (filters: {
    exactMatch: string[];
    anyMatch: string[];
    exclude: string[];
    paidBy: string;
  }) => void;
}

export const PeopleFilters = ({
  flatmates,
  onFiltersChange,
}: PeopleFiltersProps) => {
  const [exactMatch, setExactMatch] = useState<string[]>([]);
  const [anyMatch, setAnyMatch] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>("");

  const handleExactMatchChange = (flatmateId: string, checked: boolean) => {
    const newExactMatch = checked
      ? [...exactMatch, flatmateId]
      : exactMatch.filter((id) => id !== flatmateId);
    setExactMatch(newExactMatch);
    applyFilters({
      exactMatch: newExactMatch,
      anyMatch,
      exclude,
      paidBy,
    });
  };

  const handleAnyMatchChange = (flatmateId: string, checked: boolean) => {
    const newAnyMatch = checked
      ? [...anyMatch, flatmateId]
      : anyMatch.filter((id) => id !== flatmateId);
    setAnyMatch(newAnyMatch);
    applyFilters({
      exactMatch,
      anyMatch: newAnyMatch,
      exclude,
      paidBy,
    });
  };

  const handleExcludeChange = (flatmateId: string, checked: boolean) => {
    const newExclude = checked
      ? [...exclude, flatmateId]
      : exclude.filter((id) => id !== flatmateId);
    setExclude(newExclude);
    applyFilters({
      exactMatch,
      anyMatch,
      exclude: newExclude,
      paidBy,
    });
  };

  const handlePaidByChange = (value: string) => {
    setPaidBy(value);
    applyFilters({
      exactMatch,
      anyMatch,
      exclude,
      paidBy: value,
    });
  };

  const applyFilters = (filters: {
    exactMatch: string[];
    anyMatch: string[];
    exclude: string[];
    paidBy: string;
  }) => {
    onFiltersChange(filters);
  };

  const resetFilters = () => {
    setExactMatch([]);
    setAnyMatch([]);
    setExclude([]);
    setPaidBy("");
    applyFilters({
      exactMatch: [],
      anyMatch: [],
      exclude: [],
      paidBy: "",
    });
  };

  const hasActiveFilters =
    exactMatch.length > 0 ||
    anyMatch.length > 0 ||
    exclude.length > 0 ||
    paidBy !== "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            People Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exact Match Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Exact Match (ALL selected people must be involved)
          </Label>
          <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-secondary/30 rounded-lg border border-border/50">
            {flatmates.map((flatmate) => (
              <div key={flatmate.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`exact-${flatmate.id}`}
                  checked={exactMatch.includes(flatmate.id)}
                  onCheckedChange={(checked) =>
                    handleExactMatchChange(flatmate.id, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`exact-${flatmate.id}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {flatmate.name}
                </Label>
              </div>
            ))}
          </div>
          {exactMatch.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {exactMatch.map((id) => {
                const flatmate = flatmates.find((f) => f.id === id);
                return (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {flatmate?.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Any Match Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Any Match (ANY selected people involved)
          </Label>
          <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-secondary/30 rounded-lg border border-border/50">
            {flatmates.map((flatmate) => (
              <div key={flatmate.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`any-${flatmate.id}`}
                  checked={anyMatch.includes(flatmate.id)}
                  onCheckedChange={(checked) =>
                    handleAnyMatchChange(flatmate.id, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`any-${flatmate.id}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {flatmate.name}
                </Label>
              </div>
            ))}
          </div>
          {anyMatch.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {anyMatch.map((id) => {
                const flatmate = flatmates.find((f) => f.id === id);
                return (
                  <Badge key={id} variant="outline" className="text-xs">
                    {flatmate?.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Exclude Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Exclude (Hide expenses involving these people)
          </Label>
          <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-secondary/30 rounded-lg border border-border/50">
            {flatmates.map((flatmate) => (
              <div key={flatmate.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`exclude-${flatmate.id}`}
                  checked={exclude.includes(flatmate.id)}
                  onCheckedChange={(checked) =>
                    handleExcludeChange(flatmate.id, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`exclude-${flatmate.id}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {flatmate.name}
                </Label>
              </div>
            ))}
          </div>
          {exclude.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {exclude.map((id) => {
                const flatmate = flatmates.find((f) => f.id === id);
                return (
                  <Badge key={id} variant="destructive" className="text-xs">
                    {flatmate?.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Paid By Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Paid By</Label>
          <Select value={paidBy || "all"} onValueChange={(value) => handlePaidByChange(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {flatmates.map((flatmate) => (
                <SelectItem key={flatmate.id} value={flatmate.id}>
                  {flatmate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

