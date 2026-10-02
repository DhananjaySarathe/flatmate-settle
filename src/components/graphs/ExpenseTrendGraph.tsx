import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatMoneyCompact, parseDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TrendPeriod = "day" | "week" | "month";

interface ExpenseTrendGraphProps {
  expenses: { date: string; amount: number }[];
  period: TrendPeriod;
  className?: string;
}

interface TrendPoint {
  /** Sortable bucket key: "yyyy-MM-dd" (day, or the Sunday a week starts on) or "yyyy-MM". */
  key: string;
  amount: number;
  axisLabel: string;
  tooltipLabel: string;
}

/** Gaps between the first and last bucket are filled with zeros, up to this many points. */
const MAX_FILLED_POINTS = 2000;
/** Above this many points the line has no dots. */
const MAX_DOTTED_POINTS = 31;

const bucketStart = (date: Date, period: TrendPeriod) =>
  period === "day" ? date : period === "week" ? startOfWeek(date, { weekStartsOn: 0 }) : startOfMonth(date);

const keyOf = (date: Date, period: TrendPeriod) => format(date, period === "month" ? "yyyy-MM" : "yyyy-MM-dd");

const dateOfKey = (key: string, period: TrendPeriod) => parseDay(period === "month" ? `${key}-01` : key);

const nextBucket = (date: Date, period: TrendPeriod) =>
  period === "day" ? addDays(date, 1) : period === "week" ? addWeeks(date, 1) : addMonths(date, 1);

const buildPoints = (expenses: ExpenseTrendGraphProps["expenses"], period: TrendPeriod): TrendPoint[] => {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = keyOf(bucketStart(parseDay(expense.date), period), period);
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }
  const keys = [...totals.keys()].sort();
  if (keys.length === 0) return [];

  const first = dateOfKey(keys[0], period);
  const last = dateOfKey(keys[keys.length - 1], period);
  const lastKey = keys[keys.length - 1];

  // Fill the quiet days/weeks/months so the line's spacing matches real time.
  const filled: string[] = [];
  for (let d = first; filled.length <= MAX_FILLED_POINTS; d = nextBucket(d, period)) {
    const key = keyOf(d, period);
    filled.push(key);
    if (key >= lastKey) break;
  }
  const series = filled[filled.length - 1] === lastKey && filled.length <= MAX_FILLED_POINTS ? filled : keys;

  const multiYear = first.getFullYear() !== last.getFullYear();
  const axisPattern =
    period === "month" ? (multiYear ? "MMM yy" : "MMM") : multiYear ? "d MMM yy" : "d MMM";
  const tooltipPattern =
    period === "day"
      ? multiYear
        ? "EEE d MMM yyyy"
        : "EEE d MMM"
      : period === "week"
        ? multiYear
          ? "'Week of' d MMM yyyy"
          : "'Week of' d MMM"
        : "MMMM yyyy";

  return series.map((key) => {
    const date = dateOfKey(key, period);
    return {
      key,
      amount: Math.round((totals.get(key) ?? 0) * 100) / 100,
      axisLabel: format(date, axisPattern),
      tooltipLabel: format(date, tooltipPattern),
    };
  });
};

const chartConfig = {
  amount: { label: "Spent", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const TrendTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as TrendPoint;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-raised">
      <span className="text-muted-foreground">{point.tooltipLabel}</span>
      <span className="text-muted-foreground"> · </span>
      <span className="font-semibold tabular-nums text-foreground">{formatMoneyCompact(point.amount)}</span>
    </div>
  );
};

/** Spending per day, week (starting Sunday) or month, as one primary-colour area. */
export const ExpenseTrendGraph = ({ expenses, period, className }: ExpenseTrendGraphProps) => {
  const gradientId = `trend-fill-${useId().replace(/:/g, "")}`;
  const points = useMemo(() => buildPoints(expenses, period), [expenses, period]);
  const labelByKey = useMemo(() => new Map(points.map((p) => [p.key, p.axisLabel])), [points]);

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[220px] items-center justify-center text-sm text-muted-foreground sm:h-[300px]",
          className
        )}
      >
        Nothing to chart for this period.
      </div>
    );
  }

  const peak = points.reduce((max, p) => Math.max(max, p.amount), 0);
  // Room for the longest tick label, e.g. "₹1,20,000".
  const yAxisWidth = Math.max(44, Math.round(formatMoneyCompact(Math.ceil(peak)).length * 6.6) + 10);
  const showDots = points.length <= MAX_DOTTED_POINTS;

  return (
    <ChartContainer config={chartConfig} className={cn("aspect-auto h-[220px] w-full sm:h-[300px]", className)}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-amount)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-amount)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="key"
          tickFormatter={(key: string) => labelByKey.get(key) ?? key}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={20}
          interval="preserveStartEnd"
        />
        <YAxis
          width={yAxisWidth}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={<TrendTooltip />}
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          name="Spent"
          stroke="var(--color-amount)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={
            showDots
              ? { r: 3, fill: "var(--color-amount)", stroke: "hsl(var(--card))", strokeWidth: 1.5 }
              : false
          }
          activeDot={{ r: 4.5, fill: "var(--color-amount)", stroke: "hsl(var(--card))", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
};
