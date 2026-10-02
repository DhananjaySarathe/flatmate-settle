import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Flatmate {
  id: string;
  name: string;
}

export interface PeopleFilterValue {
  exactMatch: string[];
  anyMatch: string[];
  exclude: string[];
  paidBy: string[];
}

interface PeopleFiltersProps {
  flatmates: Flatmate[];
  /** Current filters. The component is controlled so reopening the dialog shows what's applied. */
  value: PeopleFilterValue;
  onFiltersChange: (filters: PeopleFilterValue) => void;
}

type Section = keyof PeopleFilterValue;

interface SectionConfig {
  id: Section;
  label: string;
  hint: string;
  selectedClass: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "paidBy",
    label: "Paid by",
    hint: "Only expenses one of these people paid for",
    selectedClass: "bg-foreground text-background border-foreground",
  },
  {
    id: "exactMatch",
    label: "Shared by all of",
    hint: "Only expenses where every selected person is in the split",
    selectedClass: "bg-primary text-primary-foreground border-primary",
  },
  {
    id: "anyMatch",
    label: "Shared by any of",
    hint: "Expenses where at least one selected person is in the split",
    selectedClass: "bg-accent text-accent-foreground border-accent",
  },
  {
    id: "exclude",
    label: "Leave out",
    hint: "Hide any expense these people paid for or are part of",
    selectedClass: "bg-destructive text-destructive-foreground border-destructive",
  },
];

export const PeopleFilters = ({ flatmates, value, onFiltersChange }: PeopleFiltersProps) => {
  const toggle = (section: Section, flatmateId: string) => {
    const current = value[section];
    const nextList = current.includes(flatmateId)
      ? current.filter((id) => id !== flatmateId)
      : [...current, flatmateId];
    onFiltersChange({ ...value, [section]: nextList });
  };

  const clearSection = (section: Section) => onFiltersChange({ ...value, [section]: [] });

  const resetAll = () => onFiltersChange({ exactMatch: [], anyMatch: [], exclude: [], paidBy: [] });

  const hasActive =
    value.exactMatch.length + value.anyMatch.length + value.exclude.length + value.paidBy.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" />
          People
        </Label>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Clear people
          </Button>
        )}
      </div>

      {flatmates.length === 0 ? (
        <p className="rounded-md bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
          No people in this space yet.
        </p>
      ) : (
        SECTIONS.map((section) => {
          const selected = value[section.id];
          return (
            <div key={section.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">{section.label}</div>
                  <div className="text-xs text-muted-foreground">{section.hint}</div>
                </div>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearSection(section.id)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
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
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? section.selectedClass
                          : "border-border bg-card text-foreground hover:bg-secondary"
                      )}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
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
