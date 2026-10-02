import { useState } from "react";
import { isSameDay } from "date-fns";
import { CalendarDays, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { DateRange as PickerRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PeopleFilters } from "@/components/PeopleFilters";
import { CategoryFilterSection } from "@/components/CategoryFilterChips";
import type { Category, Flatmate } from "@/lib/db";
import type { PeriodPreset, Range } from "@/lib/periods";
import {
  countActiveFilters,
  EMPTY_CATEGORY_FILTERS,
  EMPTY_PEOPLE_FILTERS,
  type CategoryFilterValue,
  type PeopleFilterValue,
} from "@/lib/expenseFilters";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

const sameRange = (a: Range, b: Range) => isSameDay(a.from, b.from) && isSameDay(a.to, b.to);

interface ReportControlsProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  presets: { quick: PeriodPreset[]; settled: PeriodPreset[] };
  people: PeopleFilterValue;
  onPeopleChange: (value: PeopleFilterValue) => void;
  categoryFilters: CategoryFilterValue;
  onCategoryChange: (value: CategoryFilterValue) => void;
  flatmates: Flatmate[];
  categories: Category[];
  labelOf: (id: string) => string;
}

/** Period + filters bar shared by Balances and Insights (both persist through useReportFilters). */
export const ReportControls = ({
  range,
  onRangeChange,
  presets,
  people,
  onPeopleChange,
  categoryFilters,
  onCategoryChange,
  flatmates,
  categories,
  labelOf,
}: ReportControlsProps) => {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<PickerRange | undefined>();

  const all = [...presets.quick, ...presets.settled];
  const match = all.find((p) => sameRange(p.range, range));
  const activeCount = countActiveFilters(people, categoryFilters);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...people.paidBy.map((id) => ({
      key: `paid-${id}`,
      label: `Paid by ${labelOf(id)}`,
      remove: () => onPeopleChange({ ...people, paidBy: people.paidBy.filter((x) => x !== id) }),
    })),
    ...people.anyMatch.map((id) => ({
      key: `any-${id}`,
      label: `Includes ${labelOf(id)}`,
      remove: () => onPeopleChange({ ...people, anyMatch: people.anyMatch.filter((x) => x !== id) }),
    })),
    ...people.exactMatch.map((id) => ({
      key: `all-${id}`,
      label: `Must include ${labelOf(id)}`,
      remove: () => onPeopleChange({ ...people, exactMatch: people.exactMatch.filter((x) => x !== id) }),
    })),
    ...people.exclude.map((id) => ({
      key: `ex-${id}`,
      label: `Without ${labelOf(id)}`,
      remove: () => onPeopleChange({ ...people, exclude: people.exclude.filter((x) => x !== id) }),
    })),
    ...categoryFilters.include.map((id) => ({
      key: `ci-${id}`,
      label: `Only ${categoryName(id)}`,
      remove: () => onCategoryChange({ ...categoryFilters, include: categoryFilters.include.filter((x) => x !== id) }),
    })),
    ...categoryFilters.exclude.map((id) => ({
      key: `ce-${id}`,
      label: `No ${categoryName(id)}`,
      remove: () => onCategoryChange({ ...categoryFilters, exclude: categoryFilters.exclude.filter((x) => x !== id) }),
    })),
  ];

  const pick = (preset: PeriodPreset) => {
    onRangeChange(preset.range);
    setDraft(undefined);
    setPeriodOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          open={periodOpen}
          onOpenChange={(open) => {
            setPeriodOpen(open);
            if (!open) setDraft(undefined);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 max-w-full justify-start gap-2 px-3 font-normal">
              <CalendarDays className="text-muted-foreground" />
              <span className="truncate">
                {match && !match.id.startsWith("settled:") ? (
                  <>
                    <span className="font-medium">{match.label}</span>
                    <span className="hidden text-muted-foreground sm:inline">
                      {" · "}
                      {formatRange(range.from, range.to)}
                    </span>
                  </>
                ) : (
                  <span className="font-medium">{formatRange(range.from, range.to)}</span>
                )}
              </span>
              <ChevronDown className="ml-1 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="flex max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0 sm:flex-row"
          >
            <div className="min-w-48 border-b p-2 sm:border-b-0 sm:border-r">
              {presets.quick.map((p) => (
                <PresetButton key={p.id} preset={p} active={match?.id === p.id} onPick={pick} />
              ))}
              {presets.settled.length > 0 && (
                <>
                  <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Settled periods</p>
                  {presets.settled.map((p) => (
                    <PresetButton key={p.id} preset={p} active={match?.id === p.id} onPick={pick} />
                  ))}
                </>
              )}
            </div>
            <div className="p-1">
              <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                {draft?.from && !draft.to ? "Now pick the end date" : "Or pick a start and end date"}
              </p>
              <Calendar
                mode="range"
                selected={draft ?? { from: range.from, to: range.to }}
                defaultMonth={draft?.from ?? range.to}
                onSelect={(next, day) => {
                  // Start a fresh range on the first click, then finish it on the second.
                  if (!draft || (draft.from && draft.to)) {
                    setDraft({ from: day, to: undefined });
                    return;
                  }
                  if (next?.from && next.to) {
                    onRangeChange({ from: next.from, to: next.to });
                    setDraft(undefined);
                    setPeriodOpen(false);
                  } else {
                    setDraft({ from: day, to: undefined });
                  }
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant={filtersOpen ? "secondary" : "outline"}
          className="h-10 gap-2 px-3"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="text-muted-foreground" />
          Filters
          {activeCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-[13px]"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.remove}
                className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={`Remove filter: ${chip.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              onPeopleChange(EMPTY_PEOPLE_FILTERS);
              onCategoryChange(EMPTY_CATEGORY_FILTERS);
            }}
            className="px-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {filtersOpen && (
        <div className="grid gap-6 rounded-2xl border bg-card p-4 sm:p-5 lg:grid-cols-2">
          <PeopleFilters flatmates={flatmates} value={people} onChange={onPeopleChange} labelOf={labelOf} />
          <CategoryFilterSection
            categories={categories}
            categoryFilters={categoryFilters}
            setCategoryFilters={onCategoryChange}
          />
          <div className="flex justify-end lg:col-span-2">
            <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const PresetButton = ({
  preset,
  active,
  onPick,
}: {
  preset: PeriodPreset;
  active: boolean;
  onPick: (p: PeriodPreset) => void;
}) => (
  <button
    type="button"
    onClick={() => onPick(preset)}
    className={cn(
      "flex w-full flex-col rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
      active && "bg-primary/10 text-primary hover:bg-primary/10"
    )}
  >
    <span className="font-medium">{preset.label}</span>
    {preset.hint && <span className="truncate text-xs text-muted-foreground">{preset.hint}</span>}
  </button>
);
