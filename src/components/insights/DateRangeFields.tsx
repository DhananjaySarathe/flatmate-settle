import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay } from "@/lib/format";

interface DateRange {
  from: Date;
  to: Date;
}

const DateField = ({
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
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48 sm:flex-none"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium">{formatDay(value)}</span>
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
          onSelect={(date) => {
            if (date) onChange(date);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

/** "From" and "To" date buttons for a custom period. "To" can't be before "From". */
export const DateRangeFields = ({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center" role="group" aria-label="Custom period">
    <DateField
      label="From"
      value={range.from}
      disabledAfter={range.to}
      onChange={(from) => onChange({ ...range, from })}
    />
    <DateField
      label="To"
      value={range.to}
      disabledBefore={range.from}
      onChange={(to) => onChange({ ...range, to })}
    />
  </div>
);
