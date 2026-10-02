import { Chip } from "@/components/common/Chip";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import type { PeopleFilterValue } from "@/lib/expenseFilters";

interface Flatmate {
  id: string;
  name: string;
}

interface PeopleFiltersProps {
  flatmates: Flatmate[];
  /** Controlled: always reflects the persisted filters. */
  value: PeopleFilterValue;
  onChange: (filters: PeopleFilterValue) => void;
}

type Section = keyof PeopleFilterValue;

const SECTIONS: { id: Section; label: string; hint: string; tone: "primary" | "danger" }[] = [
  {
    id: "paidBy",
    label: "Paid by",
    hint: "Only expenses one of these people paid for",
    tone: "primary",
  },
  {
    id: "anyMatch",
    label: "Split with any of",
    hint: "Expenses where at least one of these people has a share",
    tone: "primary",
  },
  {
    id: "exactMatch",
    label: "Split with all of",
    hint: "Only expenses where every one of these people has a share",
    tone: "primary",
  },
  {
    id: "exclude",
    label: "Hide",
    hint: "Hide anything these people paid for or have a share in",
    tone: "danger",
  },
];

export const PeopleFilters = ({ flatmates, value, onChange }: PeopleFiltersProps) => {
  if (flatmates.length === 0) {
    return <p className="text-sm text-muted-foreground">Add people to filter by them.</p>;
  }

  const toggle = (section: Section, id: string) => {
    const current = value[section];
    onChange({
      ...value,
      [section]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  };

  return (
    <div className="space-y-5">
      {SECTIONS.map((section) => {
        const selected = value[section.id];
        return (
          <fieldset key={section.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <legend className="text-sm font-medium">{section.label}</legend>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </div>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, [section.id]: [] })}
                  className="shrink-0 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {flatmates.map((f) => (
                <Chip
                  key={f.id}
                  tone={section.tone}
                  selected={selected.includes(f.id)}
                  showCheck
                  onClick={() => toggle(section.id, f.id)}
                  leading={<PersonAvatar name={f.name} size="xs" />}
                  className="h-9"
                >
                  {f.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
};
