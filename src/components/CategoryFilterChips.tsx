import { Chip } from "@/components/common/Chip";
import type { CategoryFilterValue } from "@/lib/expenseFilters";

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  categoryFilters: CategoryFilterValue;
  setCategoryFilters: (v: CategoryFilterValue) => void;
}

export const CategoryFilterSection = ({ categories, categoryFilters, setCategoryFilters }: Props) => {
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories yet.</p>;
  }

  // A category can be shown-only or hidden, never both.
  const toggle = (section: "include" | "exclude", categoryId: string) => {
    const current = categoryFilters[section];
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    const withoutId = (ids: string[]) => ids.filter((id) => id !== categoryId);
    setCategoryFilters(
      section === "include"
        ? { include: next, exclude: withoutId(categoryFilters.exclude) }
        : { include: withoutId(categoryFilters.include), exclude: next }
    );
  };

  const sections = [
    { id: "include" as const, label: "Only these categories", hint: "Hide everything else", tone: "primary" as const },
    { id: "exclude" as const, label: "Hide these categories", hint: "Everything else stays", tone: "danger" as const },
  ];

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const selected = categoryFilters[section.id];
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
                  onClick={() => setCategoryFilters({ ...categoryFilters, [section.id]: [] })}
                  className="shrink-0 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip
                  key={`${section.id}-${c.id}`}
                  tone={section.tone}
                  selected={selected.includes(c.id)}
                  showCheck
                  onClick={() => toggle(section.id, c.id)}
                  className="h-9"
                >
                  {c.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
};
