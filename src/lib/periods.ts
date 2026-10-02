import { endOfMonth, max as maxDate, min as minDate, startOfMonth, subMonths } from "date-fns";
import type { Expense, SavedSettlement } from "@/lib/db";
import { openPeriod, openPeriodRange } from "@/lib/ledger";
import { formatRange, parseDateOnly } from "@/lib/format";

export interface Range {
  from: Date;
  to: Date;
}

export interface PeriodPreset {
  id: string;
  label: string;
  range: Range;
  hint?: string | null;
}

/** Quick ranges, including "since last settle-up" and every settled period. */
export const buildPeriodPresets = (expenses: Expense[], settlements: SavedSettlement[]) => {
  const today = new Date();
  const quick: PeriodPreset[] = [];
  const open = openPeriod(expenses, settlements);
  if (open.lastSettlement) quick.push({ id: "open", label: "Since last settle-up", range: openPeriodRange(open) });
  quick.push({ id: "this-month", label: "This month", range: { from: startOfMonth(today), to: today } });
  const last = subMonths(today, 1);
  quick.push({ id: "last-month", label: "Last month", range: { from: startOfMonth(last), to: endOfMonth(last) } });
  if (expenses.length > 0) {
    const dates = expenses.map((e) => parseDateOnly(e.date));
    quick.push({ id: "all", label: "All time", range: { from: minDate(dates), to: maxDate([today, ...dates]) } });
  }
  const settled: PeriodPreset[] = [...settlements]
    .sort((a, b) => (a.to_date < b.to_date ? 1 : -1))
    .map((s) => ({
      id: `settled:${s.id}`,
      label: formatRange(parseDateOnly(s.from_date), parseDateOnly(s.to_date)),
      range: { from: parseDateOnly(s.from_date), to: parseDateOnly(s.to_date) },
      hint: s.note,
    }));
  return { quick, settled };
};
