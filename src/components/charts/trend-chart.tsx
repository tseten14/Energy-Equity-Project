import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  key: string;
  label: string;
  /** A CSS color, normally one of the --chart-* tokens. */
  color: string;
}

type Row = Record<string, string | number | undefined>;

interface TrendChartProps {
  data: Row[];
  xKey: string;
  series: TrendSeries[];
  kind?: "line" | "bar";
  stacked?: boolean;
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  formatX?: (value: string | number) => string;
  /** Per-bar color for single-series bar charts, e.g. to separate gains from losses. */
  barColor?: ((value: number) => string) | undefined;
  ariaLabel: string;
  className?: string;
}

export function TrendChart({
  data,
  xKey,
  series,
  kind = "line",
  stacked = false,
  formatValue,
  formatTick = formatValue,
  formatX = String,
  barColor,
  ariaLabel,
  className,
}: TrendChartProps) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );
  const hasNegative = data.some((row) => series.some((s) => Number(row[s.key]) < 0));

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis
        dataKey={xKey}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        tickFormatter={formatX}
        minTickGap={16}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={56}
        tickFormatter={(v: number) => formatTick(v)}
        domain={kind === "line" ? ["auto", "auto"] : [hasNegative ? "auto" : 0, "auto"]}
      />
      <ChartTooltip
        cursor={kind === "bar" ? { fill: "var(--chart-empty)" } : true}
        content={<ValueTooltip series={series} formatValue={formatValue} formatX={formatX} />}
      />
    </>
  );

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-64 w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {kind === "line" ? (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {axes}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2.5}
              dot={data.length <= 24 ? { r: 3, fill: `var(--color-${s.key})` } : false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {axes}
          {hasNegative ? <ReferenceLine y={0} stroke="var(--chart-4)" /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={`var(--color-${s.key})`}
              {...(stacked ? { stackId: "stack" } : {})}
              radius={stacked && i < series.length - 1 ? 0 : [6, 6, 0, 0]}
              maxBarSize={48}
            >
              {barColor && series.length === 1
                ? data.map((row) => (
                    <Cell key={String(row[xKey])} fill={barColor(Number(row[s.key]))} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}

function ValueTooltip({
  active,
  payload,
  label,
  series,
  formatValue,
  formatX,
}: TooltipProps<number, string> & {
  series: TrendSeries[];
  formatValue: (value: number) => string;
  formatX: (value: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const items = series.flatMap((s) => {
    const entry = payload.find((p) => p.dataKey === s.key);
    return typeof entry?.value === "number" ? [{ ...s, value: entry.value }] : [];
  });
  if (!items.length) return null;

  return (
    <div className="grid min-w-[9rem] gap-1.5 rounded-lg border border-border bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{formatX(label as string | number)}</p>
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-foreground/65">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
          <span className="font-semibold tabular-nums">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
