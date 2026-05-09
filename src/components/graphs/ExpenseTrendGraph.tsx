import { useMemo } from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { format } from "date-fns";

interface Expense {
  date: string;
  amount: number;
}

interface ExpenseTrendGraphProps {
  expenses: Expense[];
  period: "day" | "week" | "month";
}

export const ExpenseTrendGraph = ({
  expenses,
  period,
}: ExpenseTrendGraphProps) => {
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};

    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      let key: string;

      if (period === "day") {
        key = format(date, "MMM dd");
      } else if (period === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `Week of ${format(weekStart, "MMM dd")}`;
      } else {
        key = format(date, "MMM yyyy");
      }

      grouped[key] = (grouped[key] || 0) + expense.amount;
    });

    // Convert to array and sort properly
    const entries = Object.entries(grouped);
    
    // Sort by the original date keys
    const sortedEntries = entries.sort((a, b) => {
      if (period === "day") {
        // Parse "MMM dd" format
        const dateA = new Date(a[0] + " " + new Date().getFullYear());
        const dateB = new Date(b[0] + " " + new Date().getFullYear());
        return dateA.getTime() - dateB.getTime();
      } else if (period === "week") {
        // Parse "Week of MMM dd" format
        const dateA = new Date(a[0].replace("Week of ", "") + " " + new Date().getFullYear());
        const dateB = new Date(b[0].replace("Week of ", "") + " " + new Date().getFullYear());
        return dateA.getTime() - dateB.getTime();
      } else {
        // Parse "MMM yyyy" format
        const dateA = new Date(a[0] + " 01");
        const dateB = new Date(b[0] + " 01");
        return dateA.getTime() - dateB.getTime();
      }
    });

    return sortedEntries.map(([date, amount]) => ({ 
      date, 
      amount: Number(amount.toFixed(2)) 
    }));
  }, [expenses, period]);

  // Warm theme colors (terracotta primary)
  const PRIMARY = "#9F4F2D";
  const PRIMARY_DARK = "#7F3F24";
  const GRID = "#E1DCD5";
  const AXIS = "#78716C";

  const chartConfig = {
    amount: {
      label: "Amount",
      color: PRIMARY,
    },
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        No data available for the selected period
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.45} />
              <stop offset="50%" stopColor={PRIMARY} stopOpacity={0.18} />
              <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} opacity={0.7} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: AXIS }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, "Amount"]}
            labelFormatter={(label) => `Period: ${label}`}
            cursor={{ stroke: PRIMARY, strokeWidth: 2, strokeDasharray: "5 5" }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="none"
            fill="url(#colorAmount)"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={PRIMARY}
            strokeWidth={2.5}
            dot={{
              fill: PRIMARY,
              r: 4,
              strokeWidth: 2,
              stroke: "#ffffff",
            }}
            activeDot={{
              r: 6,
              strokeWidth: 2,
              stroke: PRIMARY_DARK,
              fill: PRIMARY,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

