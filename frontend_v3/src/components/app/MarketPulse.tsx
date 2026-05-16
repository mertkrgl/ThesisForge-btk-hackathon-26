"use client";

import { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { MOCK_BIST100_SERIES } from "@/lib/mock/watchlist";

export function MarketPulse() {
  const initialLast = MOCK_BIST100_SERIES[MOCK_BIST100_SERIES.length - 1];
  const first = MOCK_BIST100_SERIES[0];
  
  const [currentPrice, setCurrentPrice] = useState(initialLast);
  const [flashColor, setFlashColor] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    // Simulate real-time price updates (WebSocket feel)
    const interval = setInterval(() => {
      if (Math.random() > 0.6) { // 40% chance to tick
        const tick = (Math.random() - 0.4) * 4; // Slight upward bias
        setCurrentPrice(prev => prev + tick);
        setFlashColor(tick >= 0 ? "up" : "down");
        
        setTimeout(() => setFlashColor(null), 400); // Flash duration
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const deltaPct = ((currentPrice - first) / first) * 100;

  // Generate pseudo-OHLC data from the 1D series
  const ohlcData = MOCK_BIST100_SERIES.map((close, i, arr) => {
    const isLast = i === arr.length - 1;
    const actualClose = isLast ? currentPrice : close;
    const open = i === 0 ? actualClose - 15 : arr[i - 1];
    const low = Math.min(open, actualClose) - (Math.abs(open - actualClose) * 0.3 + 2);
    const high = Math.max(open, actualClose) + (Math.abs(open - actualClose) * 0.3 + 2);
    return [open, actualClose, low, high];
  });
  
  const categoryData = MOCK_BIST100_SERIES.map((_, i) => `T-${60 - i}`);

  const option = {
    grid: { left: 4, right: 4, top: 8, bottom: 4 },
    xAxis: {
      type: "category",
      data: categoryData,
      show: false,
    },
    yAxis: {
      type: "value",
      scale: true,
      show: false,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", lineStyle: { color: "#1E2A44", type: "dashed" } },
      backgroundColor: "#0B1220",
      borderColor: "#1E2A44",
      textStyle: { color: "#E6ECF5", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
    },
    series: [
      {
        type: "candlestick",
        data: ohlcData,
        itemStyle: {
          color: "#089981", // Bull
          color0: "#f23645", // Bear
          borderColor: "#089981",
          borderColor0: "#f23645",
        },
      },
    ],
  };

  // Determine flash classes
  let bgClass = "bg-card";
  if (flashColor === "up") bgClass = "bg-bull/20";
  if (flashColor === "down") bgClass = "bg-[#f23645]/20";

  return (
    <div className={`h-full flex flex-col rounded-2xl border border-border p-4 transition-colors duration-300 ${bgClass}`}>
      <div className="mb-2 flex items-baseline justify-between shrink-0">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
            BIST100 · Piyasa Nabzı
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            Son 60 gün
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {currentPrice.toFixed(2)}
          </div>
          <div
            className={
              "font-mono text-[11.5px] font-semibold " +
              (deltaPct >= 0 ? "text-bull" : "text-bear")
            }
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="flex-1 w-full mt-4 min-h-[200px]">
        <ReactECharts 
          option={option} 
          style={{ height: "100%", width: "100%" }} 
          opts={{ renderer: 'canvas' }} 
        />
      </div>
    </div>
  );
}
