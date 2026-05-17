"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({
  data,
  positive,
  height = 36,
}: {
  data: number[];
  positive: boolean;
  height?: number;
}) {
  const uid = useId();
  const series = data.map((v, i) => ({ i, v }));
  const color = positive ? "#22C55E" : "#EF4444";
  const gradientId = `spark-grad-${uid}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
