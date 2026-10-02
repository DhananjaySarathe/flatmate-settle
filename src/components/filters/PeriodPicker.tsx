import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Chip } from "@/components/common/Chip";
import { presetLabel, type DatePreset, type DateRange } from "@/lib/expenseFilters";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PeriodPickerProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  /** The dates actually in use (presets resolved from data). */
  range: DateRange;
  onCustomRangeChange: (range: DateRange) => void;
  hasSettlements: boolean;
  className?: string;
}

const DateButton = ({
  label,
  value,
  onChange,
  disabledBefore,
  disabledAfter,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  disabledBefore?: Date;
  disabledAfter?: Date;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44 sm:flex-none"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium">{format(value, "d MMM yyyy")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          disabled={[
            ...(disabledBefore ? [{ before: disabledBefore }] : []),
            ...(disabledAfter ? [{ after: disabledAfter }] : []),
          ]}
          onSelect={(d) => {
            if (d) onChange(d);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

/** Period presets plus an explicit from/to for "Custom". */
export const PeriodPicker = ({
  preset,
  onPresetChange,
  range,
  onCustomRangeChange,
  hasSettlements,
  className,
}: PeriodPickerProps) => {
  const presets: DatePreset[] = [
    ...(hasSettlements ? (["since-settlement"] as DatePreset[]) : []),
    "this-month",
    "last-month",
    "all-time",
    "custom",
  ];
  // Without saved settlements "since last settle-up" means all time.
  const effective: DatePreset = !hasSettlements && preset === "since-settlement" ? "all-time" : preset;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label="Period"
      >
        {presets.map((p) => (
          <Chip
            key={p}
            tone="neutral"
            selected={effective === p}
            onClick={() => {
              // Entering "Custom" starts from whatever is showing now.
              if (p === "custom") onCustomRangeChange(range);
              else onPresetChange(p);
            }}
            className="h-9 shrink-0"
          >
            {presetLabel(p, hasSettlements)}
          </Chip>
        ))}
      </div>

      {effective === "custom" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DateButton
            label="From"
            value={range.from}
            disabledAfter={range.to}
            onChange={(from) => onCustomRangeChange({ ...range, from })}
          />
          <DateButton
            label="To"
            value={range.to}
            disabledBefore={range.from}
            onChange={(to) => onCustomRangeChange({ ...range, to })}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground tabular-nums">{formatRange(range.from, range.to)}</p>
      )}
    </div>
  );
};
