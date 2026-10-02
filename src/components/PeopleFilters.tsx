import { ChoiceChip } from "@/components/ChoiceChip";
import type { PeopleFilterValue } from "@/lib/expenseFilters";

interface Flatmate {
  id: string;
  name: string;
}

interface PeopleFiltersProps {
  flatmates: Flatmate[];
  /** Controlled: the persisted filter state from useReportFilters. */
  value: PeopleFilterValue;
  onChange: (filters: PeopleFilterValue) => void;
  labelOf?: (id: string) => string;
}

type Section = keyof PeopleFilterValue;

const SECTIONS: { id: Section; label: string; hint: string; tone?: "negative" }[] = [
  { id: "paidBy", label: "Paid by", hint: "Only expenses these people paid for" },
  { id: "anyMatch", label: "Includes any of", hint: "At least one of them is in the split" },
  { id: "exactMatch", label: "Includes all of", hint: "Every one of them is in the split" },
  { id: "exclude", label: "Leave out", hint: "Hide anything they paid for or are in", tone: "negative" },
];

export const PeopleFilters = ({ flatmates, value, onChange, labelOf }: PeopleFiltersProps) => {
  const toggle = (section: Section, id: string) => {
    const current = value[section];
    onChange({
      ...value,
      [section]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  };

  if (flatmates.length === 0) {
    return <p className="text-sm text-muted-foreground">No people in this space yet.</p>;
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => (
        <fieldset key={section.id}>
          <legend className="text-sm font-medium">
            {section.label} <span className="font-normal text-muted-foreground">· {section.hint}</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {flatmates.map((f) => (
              <ChoiceChip
                key={f.id}
                selected={value[section.id].includes(f.id)}
                check
                tone={section.tone}
                onClick={() => toggle(section.id, f.id)}
                className="min-h-8 px-2.5 text-[13px]"
              >
                {labelOf ? labelOf(f.id) : f.name}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
};
