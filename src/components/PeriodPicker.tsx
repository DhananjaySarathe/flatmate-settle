import { ReactNode, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PeriodChip {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

interface PeriodPickerProps {
  chips: PeriodChip[];
  range: { from: Date; to: Date };
  onCustomRange: (range: { from: Date; to: Date }) => void;
  /** Highlight the custom chip (no preset matches). */
  customActive: boolean;
  /** Right-aligned extra control, e.g. a Filters button. */
  trailing?: ReactNode;
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-card hover:border-foreground/30 hover:bg-secondary"
  );

/** Preset chips plus a custom range popover. Scrolls sideways on phones. */
export const PeriodPicker = ({ chips, range, onCustomRange, customActive, trailing }: PeriodPickerProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {chips.map((c) => (
        <button key={c.key} type="button" aria-pressed={c.active} onClick={c.onSelect} className={chipClass(c.active)}>
          {c.label}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-pressed={customActive} className={chipClass(customActive)}>
            <CalendarIcon className="h-3.5 w-3.5" />
            {customActive ? formatRange(range.from, range.to) : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={range.from}
            selected={{ from: range.from, to: range.to }}
            onSelect={(next) => {
              if (next?.from) onCustomRange({ from: next.from, to: next.to ?? next.from });
            }}
            numberOfMonths={1}
            initialFocus
          />
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">{formatRange(range.from, range.to)}</span>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {trailing && <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">{trailing}</div>}
    </div>
  );
};
