import { ChoiceChip } from "@/components/ChoiceChip";
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

/** "Only" and "Leave out" are mutually exclusive per category. */
export const CategoryFilterSection = ({ categories, categoryFilters, setCategoryFilters }: Props) => {
  const toggle = (section: "include" | "exclude", categoryId: string) => {
    const current = categoryFilters[section];
    const next = current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId];
    if (section === "include") {
      setCategoryFilters({ include: next, exclude: categoryFilters.exclude.filter((id) => id !== categoryId) });
    } else {
      setCategoryFilters({ include: categoryFilters.include.filter((id) => id !== categoryId), exclude: next });
    }
  };

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories yet.</p>;
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">
          Only these categories <span className="font-normal text-muted-foreground">· hide everything else</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <ChoiceChip
              key={`inc-${c.id}`}
              selected={categoryFilters.include.includes(c.id)}
              check
              onClick={() => toggle("include", c.id)}
              className="min-h-8 px-2.5 text-[13px]"
            >
              {c.name}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">
          Leave out <span className="font-normal text-muted-foreground">· hide these categories</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <ChoiceChip
              key={`exc-${c.id}`}
              selected={categoryFilters.exclude.includes(c.id)}
              check
              tone="negative"
              onClick={() => toggle("exclude", c.id)}
              className="min-h-8 px-2.5 text-[13px]"
            >
              {c.name}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
