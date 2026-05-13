"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MOCK_BIST100_SERIES } from "@/lib/mock/watchlist";

export function MarketPulse() {
  const series = MOCK_BIST100_SERIES.map((v, i) => ({ i, v }));
  const last = series[series.length - 1].v;
  const first = series[0].v;
  const deltaPct = ((last - first) / first) * 100;

  return (
    <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,#0C1428,#0A1122)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-white">
            BIST100 · Piyasa Nabzı
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            Son 60 gün
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-white">
            {last.toFixed(0)}
          </div>
          <div
            className={
              "font-mono text-[11.5px] font-semibold " +
              (deltaPct >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]")
            }
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bistFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["dataMin - 30", "dataMax + 30"]} />
            <Tooltip
              cursor={{ stroke: "#1E2A44" }}
              contentStyle={{
                background: "#0B1220",
                border: "1px solid #1E2A44",
                fontSize: 11,
                color: "#E6ECF5",
                borderRadius: 8,
              }}
              labelFormatter={() => ""}
              formatter={(v) => [Number(v).toFixed(0), "BIST100"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#3B82F6"
              strokeWidth={1.8}
              fill="url(#bistFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
