import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { formatMoney, formatMoneyShort, parseDateOnly, toDateOnly } from "@/lib/format";

interface Expense {
  date: string;
  amount: number;
}

export type TrendPeriod = "day" | "week" | "month";

interface ExpenseTrendGraphProps {
  expenses: Expense[];
  period: TrendPeriod;
  /** The selected date range; empty days/weeks/months inside it are shown as zero. */
  range?: { from: Date; to: Date };
  /** Show the same numbers as a table instead of a chart. */
  asTable?: boolean;
}

interface Bucket {
  key: string;
  label: string;
  long: string;
  amount: number;
  count: number;
}

const bucketStart = (d: Date, period: TrendPeriod) =>
  period === "day" ? d : period === "week" ? startOfWeek(d) : startOfMonth(d);

const step = (d: Date, period: TrendPeriod) =>
  period === "day" ? addDays(d, 1) : period === "week" ? addWeeks(d, 1) : addMonths(d, 1);

const labels = (d: Date, period: TrendPeriod) =>
  period === "day"
    ? { label: format(d, "MMM d"), long: format(d, "EEE, MMM d, yyyy") }
    : period === "week"
      ? { label: format(d, "MMM d"), long: `Week of ${format(d, "MMM d, yyyy")}` }
      : { label: format(d, "MMM yy"), long: format(d, "MMMM yyyy") };

/** At most this many buckets are generated when filling gaps, so a huge custom range can't hang the page. */
const MAX_BUCKETS = 400;

export const ExpenseTrendGraph = ({ expenses, period, range, asTable }: ExpenseTrendGraphProps) => {
  const data = useMemo<Bucket[]>(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    for (const e of expenses) {
      const key = toDateOnly(bucketStart(parseDateOnly(e.date), period));
      const t = totals.get(key) ?? { amount: 0, count: 0 };
      t.amount += e.amount;
      t.count += 1;
      totals.set(key, t);
    }

    const keys = new Set(totals.keys());
    if (range) {
      let cursor = bucketStart(range.from, period);
      const end = bucketStart(range.to, period);
      for (let i = 0; cursor <= end && i < MAX_BUCKETS; i++) {
        keys.add(toDateOnly(cursor));
        cursor = step(cursor, period);
      }
    }

    return [...keys].sort().map((key) => {
      const t = totals.get(key) ?? { amount: 0, count: 0 };
      return { key, ...labels(parseDateOnly(key), period), amount: Math.round(t.amount * 100) / 100, count: t.count };
    });
  }, [expenses, period, range]);

  if (expenses.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">No spending in this period.</div>
    );
  }

  if (asTable) {
    const rows = data.filter((d) => d.count > 0).reverse();
    return (
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 font-medium">{period === "day" ? "Day" : period === "week" ? "Week" : "Month"}</th>
              <th className="py-2 text-right font-medium">Expenses</th>
              <th className="py-2 text-right font-medium">Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-2">{r.long}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{r.count}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="h-72 w-full" role="img" aria-label={`Spending per ${period}, ${data.length} bars`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.8} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            interval="preserveStartEnd"
            minTickGap={18}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => formatMoneyShort(v)}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: "hsl(var(--secondary))" }} content={<TrendTooltip />} />
          <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={24} minPointSize={0} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const TrendTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload as Bucket;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-semibold tabular-nums">{formatMoney(bucket.amount)}</div>
      <div className="text-xs text-muted-foreground">
        {bucket.long} · {bucket.count === 1 ? "1 expense" : `${bucket.count} expenses`}
      </div>
    </div>
  );
};
