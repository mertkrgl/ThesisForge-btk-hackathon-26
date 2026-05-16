"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({
  data,
  positive,
  height = 36,
}: {
  data: number[];
  positive: boolean;
  height?: number;
}) {
  const series = data.map((v, i) => ({ i, v }));
  const stroke = positive ? "#22C55E" : "#EF4444";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.6}
          dot={false}
          isAnimationActive={false}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
