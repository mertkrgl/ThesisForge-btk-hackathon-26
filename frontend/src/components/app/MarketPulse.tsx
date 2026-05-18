"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Dialog } from "@base-ui/react/dialog";
import { fetchMarketHistory, fetchMarketQuote } from "@/lib/api/market";
import type {
  BackendHistory,
  BackendQuote,
  MarketHistoryPeriod,
} from "@/lib/types/backend";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Maximize2,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";

const REFRESH_MS = 60_000;

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMarketNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Veri yok";
  return numberFormatter.format(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("candlestick");
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
  const sparkLineColor = positive ? "#089981" : "#f23645";
  const ohlcData = useMemo(() => buildOhlcData(chartSeries), [chartSeries]);
  const categoryData = useMemo(
    () => chartSeries.map((_, i) => `T-${chartSeries.length - i}`),
    [chartSeries],
  );

  const option = useMemo(() => {
    const baseAxes = {
      grid: { left: 4, right: 4, top: 8, bottom: 4 },
      xAxis: { type: "category", data: categoryData, show: false },
      yAxis: { type: "value", scale: true, show: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", lineStyle: { color: "#1E2A44", type: "dashed" } },
        backgroundColor: "#0B1220",
        borderColor: "#1E2A44",
        textStyle: { color: "#E6ECF5", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
      },
    };
    if (chartType === "line") {
      return {
        ...baseAxes,
        series: [{
          type: "line",
          data: chartSeries,
          smooth: true,
          symbol: "none",
          lineStyle: { color: sparkLineColor, width: 2 },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${sparkLineColor}44` },
                { offset: 1, color: `${sparkLineColor}00` },
              ],
            },
          },
        }],
      };
    }
    return {
      ...baseAxes,
      series: [{
        type: "candlestick",
        data: ohlcData,
        itemStyle: {
          color: "#089981",
          color0: "#f23645",
          borderColor: "#089981",
          borderColor0: "#f23645",
        },
      }],
    };
  }, [chartSeries, categoryData, ohlcData, chartType, sparkLineColor]);

  let bgClass = "bg-card";
  if (flashColor === "up") bgClass = "bg-bull/20";
  if (flashColor === "down") bgClass = "bg-[#f23645]/20";

  return (
    <div
      data-tour="dashboard-bist"
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
            {/* Mum / Çizgi toggle */}
            <div className="ml-2 inline-flex items-center gap-px rounded-md border border-border bg-card/60 p-px">
              {(["candlestick", "line"] as ChartType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartType(t)}
                  aria-pressed={chartType === t}
                  className={cn(
                    "h-5 rounded px-2 text-[10.5px] font-semibold transition-colors",
                    chartType === t
                      ? "bg-primary text-primary-foreground"
                      : "text-text-2 hover:text-white",
                  )}
                >
                  {t === "candlestick" ? "Mum" : "Çizgi"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="ml-1 grid h-6 w-6 place-items-center rounded-md border border-border bg-card text-text-2 transition-colors hover:border-primary/40 hover:text-primary"
              title="Detaylı grafiği aç"
              aria-label="Detaylı grafiği aç"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
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

      {/* Chart */}
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

      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "transition-opacity duration-200",
            )}
          />
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex w-[min(1280px,94vw)] max-h-[92vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-background shadow-2xl outline-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-200",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    positive ? "bg-bull/10" : "bg-bear/10",
                  )}
                >
                  {positive ? (
                    <TrendingUp className="h-4 w-4 text-bull" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-bear" />
                  )}
                </div>
                <div>
                  <Dialog.Title className="text-[15px] font-bold text-slate-900 dark:text-white">
                    BIST 100 · Detaylı Görünüm
                  </Dialog.Title>
                  <Dialog.Description className="text-[11.5px] text-muted-foreground">
                    Mum / Çizgi grafik · 1 gün / 1 hafta / 1 ay
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-text-2 transition-colors hover:border-primary/40 hover:text-primary"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <BistDetailChart />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BistDetailChart — ECharts candlestick + period buttons
// ─────────────────────────────────────────────────────────

const PERIODS: Array<{ value: MarketHistoryPeriod; label: string }> = [
  { value: "1d", label: "1 Gün" },
  { value: "1w", label: "1 Hafta" },
  { value: "1mo", label: "1 Ay" },
];

type ChartType = "candlestick" | "line";

const detailNumberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatTickLabel(iso: string, period: MarketHistoryPeriod): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (period === "1d") {
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function BistDetailChart() {
  const [period, setPeriod] = useState<MarketHistoryPeriod>("1w");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [data, setData] = useState<BackendHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const loading = !error && (data == null || data.period !== period);

  useEffect(() => {
    let cancelled = false;
    fetchMarketHistory("XU100", period)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Geçmiş veri alınamadı");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period, retryNonce]);

  const positive = (data?.delta_pct ?? 0) >= 0;
  const lineColor = positive ? "#089981" : "#f23645";
  const detailDeltaPct = isFiniteNumber(data?.delta_pct) ? data.delta_pct : null;

  const option = useMemo(() => {
    const points = (data?.points ?? []).filter(
      (p) =>
        isFiniteNumber(p.o) &&
        isFiniteNumber(p.c) &&
        isFiniteNumber(p.l) &&
        isFiniteNumber(p.h),
    );
    const categories = points.map((p) => formatTickLabel(p.t, period));
    const ohlc = points.map((p) => [p.o, p.c, p.l, p.h]);
    const closes = points.map((p) => p.c);

    const baseAxes = {
      animation: true,
      animationDuration: 600,
      grid: { left: 56, right: 16, top: 16, bottom: 36 },
      xAxis: {
        type: "category",
        data: categories,
        boundaryGap: chartType === "candlestick",
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.3)" } },
        axisLabel: { color: "#94a3b8", fontSize: 10.5, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.3)" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10.5,
          formatter: (v: number) => detailNumberFormatter.format(v),
        },
        splitLine: {
          lineStyle: { color: "rgba(148,163,184,0.15)", type: "dashed" },
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          lineStyle: { color: "#1E2A44", type: "dashed" },
        },
        backgroundColor: "#0B1220",
        borderColor: "#1E2A44",
        textStyle: {
          color: "#E6ECF5",
          fontSize: 11,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            dataIndex: number;
            data: number | number[];
            axisValue: string;
          }>;
          if (!arr?.length) return "";
          const p = arr[0];
          const i = p.dataIndex;
          const volume = points[i]?.v;
          const fmt = (n: number | null | undefined) =>
            isFiniteNumber(n) ? detailNumberFormatter.format(n) : "Veri yok";
          if (chartType === "line") {
            const close = p.data as number;
            return [
              `<div style="font-weight:600;margin-bottom:4px">${p.axisValue}</div>`,
              `Kapanış: <b>${fmt(close)}</b>`,
              isFiniteNumber(volume)
                ? `<br/>Hacim: <b>${compactFormatter.format(volume)}</b>`
                : "",
            ].join("");
          }
          const v = p.data as number[];
          return [
            `<div style="font-weight:600;margin-bottom:4px">${p.axisValue}</div>`,
            `Açılış: <b>${fmt(v[1])}</b><br/>`,
            `Kapanış: <b>${fmt(v[2])}</b><br/>`,
            `Yüksek: <b>${fmt(v[4])}</b><br/>`,
            `Düşük: <b>${fmt(v[3])}</b>`,
            isFiniteNumber(volume)
              ? `<br/>Hacim: <b>${compactFormatter.format(volume)}</b>`
              : "",
          ].join("");
        },
      },
    };

    if (chartType === "line") {
      return {
        ...baseAxes,
        series: [
          {
            type: "line",
            data: closes,
            smooth: true,
            symbol: "none",
            lineStyle: { color: lineColor, width: 2 },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${lineColor}33` },
                  { offset: 1, color: `${lineColor}00` },
                ],
              },
            },
          },
        ],
      };
    }

    return {
      ...baseAxes,
      series: [
        {
          type: "candlestick",
          data: ohlc,
          itemStyle: {
            color: "#089981",
            color0: "#f23645",
            borderColor: "#089981",
            borderColor0: "#f23645",
          },
        },
      ],
    };
  }, [data, period, chartType, lineColor]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {data && !loading && (
            <>
              <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatMarketNumber(data.last)}
              </span>
              {detailDeltaPct == null ? (
                <span className="font-mono text-[12px] text-muted-foreground">
                  değişim yok
                </span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[11.5px] font-bold",
                    positive
                      ? "border-bull/30 bg-bull/10 text-bull"
                      : "border-bear/30 bg-bear/10 text-bear",
                  )}
                >
                  {positive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {detailDeltaPct >= 0 ? "+" : ""}
                  {detailDeltaPct.toFixed(2)}%
                </span>
              )}
            </>
          )}
          {loading && (
            <span className="font-mono text-[12px] text-muted-foreground">
              yükleniyor…
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart type toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
            {(["candlestick", "line"] as ChartType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                aria-pressed={chartType === t}
                className={cn(
                  "h-8 rounded-md px-3 text-[12px] font-semibold transition-colors",
                  chartType === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-text-2 hover:bg-accent hover:text-white",
                )}
              >
                {t === "candlestick" ? "Mum" : "Çizgi"}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
            {PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  aria-pressed={active}
                  className={cn(
                    "h-8 rounded-md px-3 text-[12px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-text-2 hover:bg-accent hover:text-white",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-[520px] w-full">
        {loading && !data ? (
          <div className="h-[520px] animate-pulse rounded-xl border border-border bg-card/60" />
        ) : error && !data ? (
          <div className="flex h-[520px] flex-col items-center justify-center gap-3 rounded-xl border border-bear/30 bg-bear/5 p-6 text-center">
            <p className="text-[13px] text-bear">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRetryNonce((n) => n + 1);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] text-text-2 hover:text-white"
            >
              Tekrar dene
            </button>
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: 520, width: "100%" }}
            opts={{ renderer: "canvas" }}
            notMerge
          />
        )}
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          <DetailStat
            label="Açılış"
            value={formatMarketNumber(data.first)}
          />
          <DetailStat
            label="En Yüksek"
            value={formatMarketNumber(data.high)}
            tone="bull"
          />
          <DetailStat
            label="En Düşük"
            value={formatMarketNumber(data.low)}
            tone="bear"
          />
          <DetailStat
            label="Hacim"
            value={isFiniteNumber(data.volume) ? compactFormatter.format(data.volume) : "Veri yok"}
          />
        </div>
      )}
    </div>
  );
}

function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[14px] font-bold",
          tone === "bull" && "text-bull",
          tone === "bear" && "text-bear",
          !tone && "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}
