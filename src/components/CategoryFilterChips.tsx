import { Label } from "@/components/ui/label";
import { Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface CategoryFilterValue {
  include: string[];
  exclude: string[];
}

interface Props {
  categories: Category[];
  categoryFilters: CategoryFilterValue;
  setCategoryFilters: (v: CategoryFilterValue) => void;
}

export const CategoryFilterSection = ({
  categories,
  categoryFilters,
  setCategoryFilters,
}: Props) => {
  const toggle = (
    section: "include" | "exclude",
    categoryId: string
  ) => {
    const current = categoryFilters[section];
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];

    if (section === "include") {
      // Selecting in 'include' should remove from 'exclude' (mutually exclusive)
      setCategoryFilters({
        include: next,
        exclude: categoryFilters.exclude.filter((id) => id !== categoryId),
      });
    } else {
      setCategoryFilters({
        include: categoryFilters.include.filter((id) => id !== categoryId),
        exclude: next,
      });
    }
  };

  const hasActive =
    categoryFilters.include.length + categoryFilters.exclude.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          Categories
        </Label>
        {hasActive && (
          <button
            type="button"
            onClick={() => setCategoryFilters({ include: [], exclude: [] })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear categories
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-secondary/40 rounded-md p-4 text-center">
          No categories available.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold text-foreground">
                Show only
              </div>
              <div className="text-[11px] text-muted-foreground">
                Hide everything that isn't in these categories
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const isSelected = categoryFilters.include.includes(c.id);
                return (
                  <button
                    key={`inc-${c.id}`}
                    type="button"
                    onClick={() => toggle("include", c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-foreground border-border hover:bg-secondary"
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold text-foreground">Hide</div>
              <div className="text-[11px] text-muted-foreground">
                Hide all expenses in these categories
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const isSelected = categoryFilters.exclude.includes(c.id);
                return (
                  <button
                    key={`exc-${c.id}`}
                    type="button"
                    onClick={() => toggle("exclude", c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      isSelected
                        ? "bg-destructive text-destructive-foreground border-destructive"
                        : "bg-secondary/60 text-foreground border-border hover:bg-secondary"
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
