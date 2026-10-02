import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { PeopleFilters } from "@/components/PeopleFilters";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import type { CategoryFilterValue, PeopleFilterValue } from "@/lib/expenseFilters";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

interface FiltersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  peopleFilters: PeopleFilterValue;
  categoryFilters: CategoryFilterValue;
  onPeopleFiltersChange: (value: PeopleFilterValue) => void;
  onCategoryFiltersChange: (value: CategoryFilterValue) => void;
  onClear: () => void;
  /** Live result count for the footer button. */
  matchCount: number;
  description?: string;
}

/** Filters apply as you tap; the footer shows how many expenses match. */
export const FiltersPanel = ({
  open,
  onOpenChange,
  people,
  categories,
  peopleFilters,
  categoryFilters,
  onPeopleFiltersChange,
  onCategoryFiltersChange,
  onClear,
  matchCount,
  description = "Narrow down which expenses count.",
}: FiltersPanelProps) => (
  <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
    <ResponsiveDialogContent className="sm:max-w-xl">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Filters</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</h3>
          <PeopleFilters flatmates={people} value={peopleFilters} onChange={onPeopleFiltersChange} />
        </section>
        <Separator />
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</h3>
          <CategoryFilterSection
            categories={categories}
            categoryFilters={categoryFilters}
            setCategoryFilters={onCategoryFiltersChange}
          />
        </section>
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <Button variant="ghost" onClick={onClear}>
          Clear all
        </Button>
        <Button onClick={() => onOpenChange(false)}>Show {pluralize(matchCount, "expense")}</Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialogContent>
  </ResponsiveDialog>
);

export const FiltersButton = ({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) => (
  <Button variant="outline" onClick={onClick} className={cn("gap-2", className)}>
    <SlidersHorizontal />
    Filters
    {count > 0 && (
      <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
        {count}
      </span>
    )}
  </Button>
);

/** Explains that filters are changing the numbers, with a one-tap way out. */
export const ActiveFiltersNotice = ({
  count,
  shown,
  total,
  onEdit,
  onClear,
  consequence = "Totals only count these.",
}: {
  count: number;
  shown: number;
  total: number;
  onEdit: () => void;
  onClear: () => void;
  consequence?: string;
}) =>
  count === 0 ? null : (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
      <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          {pluralize(count, "filter")} on · showing {shown} of {total} expenses.
        </span>{" "}
        <span className="text-muted-foreground">{consequence}</span>
      </p>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="h-8">
          <X /> Clear
        </Button>
      </div>
    </div>
  );
