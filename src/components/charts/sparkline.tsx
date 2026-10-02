import { Line, LineChart, YAxis } from "recharts";

import { ChartContainer } from "@/components/ui/chart";

/** A tiny trend line with no axes. Decorative: the card around it states the numbers. */
export function Sparkline({
  values,
  color = "var(--chart-1)",
}: {
  values: number[];
  color?: string;
}) {
  const data = values.map((value, i) => ({ i, value }));
  return (
    <ChartContainer
      config={{ value: { color } }}
      className="mt-4 aspect-auto h-16 w-full"
      aria-hidden="true"
    >
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
