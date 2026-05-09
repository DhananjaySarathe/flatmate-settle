import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    paidBy: string[];
  }) => void;
}

type Section = "exactMatch" | "anyMatch" | "exclude";

interface SectionConfig {
  id: Section;
  label: string;
  hint: string;
  selectedClass: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "exactMatch",
    label: "Must include all of",
    hint: "Show only expenses where every selected person is in the split",
    selectedClass: "bg-primary text-primary-foreground border-primary",
  },
  {
    id: "anyMatch",
    label: "Include any of",
    hint: "Show expenses where at least one selected person is in the split",
    selectedClass: "bg-accent text-accent-foreground border-accent",
  },
  {
    id: "exclude",
    label: "Hide expenses with",
    hint: "Hide any expense that involves these people (paid or split)",
    selectedClass: "bg-destructive text-destructive-foreground border-destructive",
  },
];

export const PeopleFilters = ({
  flatmates,
  onFiltersChange,
}: PeopleFiltersProps) => {
  const [exactMatch, setExactMatch] = useState<string[]>([]);
  const [anyMatch, setAnyMatch] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const paidBy: string[] = [];

  const setters: Record<Section, React.Dispatch<React.SetStateAction<string[]>>> = {
    exactMatch: setExactMatch,
    anyMatch: setAnyMatch,
    exclude: setExclude,
  };
  const values: Record<Section, string[]> = {
    exactMatch,
    anyMatch,
    exclude,
  };

  const apply = (next: Partial<Record<Section, string[]>>) => {
    onFiltersChange({
      exactMatch: next.exactMatch ?? exactMatch,
      anyMatch: next.anyMatch ?? anyMatch,
      exclude: next.exclude ?? exclude,
      paidBy,
    });
  };

  const toggle = (section: Section, flatmateId: string) => {
    const current = values[section];
    const nextList = current.includes(flatmateId)
      ? current.filter((id) => id !== flatmateId)
      : [...current, flatmateId];
    setters[section](nextList);
    apply({ [section]: nextList });
  };

  const clearSection = (section: Section) => {
    setters[section]([]);
    apply({ [section]: [] });
  };

  const resetAll = () => {
    setExactMatch([]);
    setAnyMatch([]);
    setExclude([]);
    onFiltersChange({ exactMatch: [], anyMatch: [], exclude: [], paidBy: [] });
  };

  const hasActive = exactMatch.length + anyMatch.length + exclude.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          People
        </Label>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Clear people
          </Button>
        )}
      </div>

      {flatmates.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-secondary/40 rounded-md p-4 text-center">
          No flatmates added yet.
        </p>
      ) : (
        SECTIONS.map((section) => {
          const selected = values[section.id];
          return (
            <div key={section.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    {section.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {section.hint}
                  </div>
                </div>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearSection(section.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {flatmates.map((f) => {
                  const isSelected = selected.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(section.id, f.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        isSelected
                          ? section.selectedClass
                          : "bg-secondary/60 text-foreground border-border hover:bg-secondary"
                      )}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
