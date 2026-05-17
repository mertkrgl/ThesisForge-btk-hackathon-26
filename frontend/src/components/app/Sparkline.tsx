"use client";

import { useMemo } from "react";
import { Area, AreaChart, YAxis } from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfigBull: ChartConfig = {
  v: { label: "Fiyat", color: "var(--color-bull)" },
};

const chartConfigBear: ChartConfig = {
  v: { label: "Fiyat", color: "var(--color-bear)" },
};

export function Sparkline({
  data,
  positive,
  height = 36,
}: {
  data: number[];
  positive: boolean;
  height?: number;
}) {
  const series = useMemo(() => data.map((v, i) => ({ i, v })), [data]);
  const config = positive ? chartConfigBull : chartConfigBear;
  const color = positive ? "var(--color-bull)" : "var(--color-bear)";

  return (
    <ChartContainer
      config={config}
      className="w-full"
      style={{ height }}
      initialDimension={{ width: 200, height }}
    >
      <AreaChart
        data={series}
        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
      >
        <defs>
          <linearGradient id={`spark-${positive ? "bull" : "bear"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          dataKey="v"
          type="monotone"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#spark-${positive ? "bull" : "bear"})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ChartContainer>
  );
}
