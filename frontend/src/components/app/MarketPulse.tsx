"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { fetchMarketQuote } from "@/lib/api/market";
import type { BackendQuote } from "@/lib/types/backend";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";

const REFRESH_MS = 60_000;

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMarketNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Veri yok";
  return numberFormatter.format(value);
}

function buildOhlcData(series: number[]) {
  return series.map((close, i, arr) => {
    const open = i === 0 ? close : arr[i - 1];
    const spread = Math.max(Math.abs(open - close) * 0.3, close * 0.0008);
    const low = Math.min(open, close) - spread;
    const high = Math.max(open, close) + spread;
    return [open, close, low, high];
  });
}

export function MarketPulse() {
  const [quote, setQuote] = useState<BackendQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState<"up" | "down" | null>(null);
  const lastRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadQuote = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const next = await fetchMarketQuote("XU100");
        if (cancelled) return;

        const previousLast = lastRef.current;
        if (previousLast != null && next.last !== previousLast) {
          setFlashColor(next.last > previousLast ? "up" : "down");
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => setFlashColor(null), 450);
        }

        lastRef.current = next.last;
        setQuote(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Piyasa verisi alınamadı");
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    loadQuote(true);
    const interval = setInterval(() => loadQuote(false), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const chartSeries = useMemo(() => {
    if (!quote) return [];
    if (quote.spark.length > 1) return quote.spark;
    return [quote.previous_close, quote.last].filter((v) => Number.isFinite(v));
  }, [quote]);

  const deltaPct = quote?.delta_pct ?? null;
  const positive = deltaPct == null || deltaPct >= 0;
  const ohlcData = useMemo(() => buildOhlcData(chartSeries), [chartSeries]);
  const categoryData = useMemo(
    () => chartSeries.map((_, i) => `T-${chartSeries.length - i}`),
    [chartSeries],
  );

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
          color: "#089981",
          color0: "#f23645",
          borderColor: "#089981",
          borderColor0: "#f23645",
        },
      },
    ],
  };

  let bgClass = "bg-card";
  if (flashColor === "up") bgClass = "bg-bull/20";
  if (flashColor === "down") bgClass = "bg-[#f23645]/20";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border p-5 transition-colors duration-300",
        bgClass,
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              positive ? "bg-bull/10" : "bg-bear/10"
            )}>
              {positive ? (
                <TrendingUp className="h-4 w-4 text-bull" />
              ) : (
                <TrendingDown className="h-4 w-4 text-bear" />
              )}
            </div>
            <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
              BIST 100
            </h2>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
            </span>
            <span className="text-[11px] text-muted-foreground">
              Anlık piyasa verisi
            </span>
            {error && quote ? (
              <span className="text-[10.5px] text-warn">· son veri korunuyor</span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            {loading && !quote ? "..." : formatMarketNumber(quote?.last)}
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            {deltaPct == null ? (
              <span className="font-mono text-[12px] text-muted-foreground">Bekleniyor</span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[11.5px] font-bold",
                  positive
                    ? "border-bull/25 bg-bull/10 text-bull"
                    : "border-bear/25 bg-bear/10 text-bear",
                )}
              >
                {positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {deltaPct >= 0 ? "+" : ""}
                {deltaPct.toFixed(2)}%
              </span>
            )}
          </div>
          {quote?.previous_close != null && (
            <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
              Önceki kapanış: {formatMarketNumber(quote.previous_close)}
            </div>
          )}
        </div>
      </div>

      {/* Candlestick Chart */}
      <div className="flex-1 w-full mt-2 min-h-[200px]">
        {loading && !quote ? (
          <div className="h-full min-h-[200px] animate-pulse rounded-xl border border-border bg-card/60" />
        ) : error && !quote ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-bear/30 bg-bear/10 px-4 text-center text-[12px] text-bear">
            {error}
          </div>
        ) : chartSeries.length > 1 ? (
          <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-border bg-card/60 text-[12px] text-muted-foreground">
            Grafik verisi yok
          </div>
        )}
      </div>
    </div>
  );
}
