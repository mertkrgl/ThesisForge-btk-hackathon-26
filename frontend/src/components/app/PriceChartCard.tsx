"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { ArrowDownRight, ArrowUpRight, ChartCandlestick, LineChart } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchMarketHistory } from "@/lib/api/market";
import { cn } from "@/lib/utils";
import type {
  BackendHistory,
  MarketHistoryPeriod,
} from "@/lib/types/backend";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type ChartMode = "line" | "candle";

const PERIOD_OPTIONS: Array<{
  value: MarketHistoryPeriod;
  label: string;
  short: string;
}> = [
  { value: "1d", label: "Bugün (intraday)", short: "1G" },
  { value: "1w", label: "Son 5 gün", short: "1H" },
  { value: "1mo", label: "Son 1 ay", short: "1A" },
];

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const volumeFormatter = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatTickTime(iso: string, period: MarketHistoryPeriod): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (period === "1d") {
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

function formatTooltipTime(iso: string, period: MarketHistoryPeriod): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (period === "1mo") {
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const chartConfigBull: ChartConfig = {
  c: { label: "Fiyat", color: "var(--color-bull)" },
};
const chartConfigBear: ChartConfig = {
  c: { label: "Fiyat", color: "var(--color-bear)" },
};

export function PriceChartCard({
  ticker,
  initialPeriod = "1w",
}: {
  ticker: string;
  initialPeriod?: MarketHistoryPeriod;
}) {
  const [period, setPeriod] = React.useState<MarketHistoryPeriod>(initialPeriod);
  const [mode, setMode] = React.useState<ChartMode>("line");
  const [data, setData] = React.useState<BackendHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [retryNonce, setRetryNonce] = React.useState(0);

  const fetching = data == null || data.period !== period;
  const loading = !error && data == null;

  React.useEffect(() => {
    let cancelled = false;
    fetchMarketHistory(ticker, period)
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
  }, [ticker, period, retryNonce]);

  const positive = (data?.delta_pct ?? 0) >= 0;
  const color = positive ? "var(--color-bull)" : "var(--color-bear)";
  const config = positive ? chartConfigBull : chartConfigBear;
  const gradientId = `price-${positive ? "bull" : "bear"}`;
  const periodMeta = PERIOD_OPTIONS.find((p) => p.value === period)!;
  const candleOption = React.useMemo<EChartsOption>(() => {
    const points = data?.points ?? [];
    const axis = points.map((p) => formatTickTime(p.t, period));
    return {
      animation: true,
      grid: { left: 54, right: 18, top: 18, bottom: 34 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        borderWidth: 1,
        formatter: (params: unknown) => {
          const rows = Array.isArray(params) ? params : [params];
          const first = rows[0] as { dataIndex?: number } | undefined;
          const point =
            typeof first?.dataIndex === "number" ? points[first.dataIndex] : null;
          if (!point) return "";
          return [
            `<strong>${formatTooltipTime(point.t, period)}</strong>`,
            `Açılış: ${priceFormatter.format(point.o)}`,
            `Kapanış: ${priceFormatter.format(point.c)}`,
            `Yüksek: ${priceFormatter.format(point.h)}`,
            `Düşük: ${priceFormatter.format(point.l)}`,
            `Hacim: ${volumeFormatter.format(point.v)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: axis,
        boundaryGap: true,
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
        axisTick: { show: false },
        axisLabel: { color: "#94A3B8", hideOverlap: true },
      },
      yAxis: {
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.16)" } },
        axisLabel: {
          color: "#94A3B8",
          formatter: (v: number) => priceFormatter.format(v),
        },
      },
      series: [
        {
          type: "candlestick",
          data: points.map((p) => [p.o, p.c, p.l, p.h]),
          itemStyle: {
            color: "#16A34A",
            color0: "#EF4444",
            borderColor: "#16A34A",
            borderColor0: "#EF4444",
          },
        },
      ],
    };
  }, [data?.points, period]);

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2 font-mono">
            Fiyat Geçmişi
            {data && !fetching && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold",
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
                {Math.abs(data.delta_pct).toFixed(2)}%
              </span>
            )}
            {fetching && data && (
              <span className="font-mono text-[10.5px] text-muted-foreground">
                yükleniyor…
              </span>
            )}
          </CardTitle>
          <CardDescription>{periodMeta.label}</CardDescription>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as MarketHistoryPeriod)}
        >
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Periyot seç"
          >
            <SelectValue placeholder="Periyot" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="rounded-lg">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
          <ModeButton
            active={mode === "line"}
            onClick={() => setMode("line")}
            label="Çizgi"
            icon={<LineChart className="h-3.5 w-3.5" />}
          />
          <ModeButton
            active={mode === "candle"}
            onClick={() => setMode("candle")}
            label="Mum"
            icon={<ChartCandlestick className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5 sm:hidden">
          {PERIOD_OPTIONS.map((p) => {
            const active = p.value === period;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                aria-pressed={active}
                className={cn(
                  "h-7 rounded-md px-3 font-mono text-[11.5px] font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-text-2 hover:text-white",
                )}
              >
                {p.short}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="h-[250px] animate-pulse rounded-xl border border-border bg-card/60" />
        ) : error && !data ? (
          <div className="flex h-[250px] flex-col items-center justify-center gap-3 rounded-xl border border-bear/30 bg-bear/5 p-6 text-center">
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
        ) : mode === "candle" ? (
          <div className="h-[250px] w-full">
            <ReactECharts
              option={candleOption}
              notMerge
              lazyUpdate
              style={{ height: 250, width: "100%" }}
            />
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto h-[250px] w-full"
            initialDimension={{ width: 800, height: 250 }}
          >
            <AreaChart data={data?.points ?? []}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="t"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => formatTickTime(value, period)}
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => priceFormatter.format(v)}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]
                    .payload as BackendHistory["points"][number];
                  return (
                    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-[11.5px] shadow-xl">
                      <div className="font-medium text-text-2">
                        {formatTooltipTime(point.t, period)}
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
                        <span className="text-muted-foreground">Kapanış</span>
                        <span className="text-right font-semibold text-slate-900 dark:text-white">
                          {priceFormatter.format(point.c)}
                        </span>
                        <span className="text-muted-foreground">Yüksek</span>
                        <span className="text-right text-bull">
                          {priceFormatter.format(point.h)}
                        </span>
                        <span className="text-muted-foreground">Düşük</span>
                        <span className="text-right text-bear">
                          {priceFormatter.format(point.l)}
                        </span>
                        <span className="text-muted-foreground">Hacim</span>
                        <span className="text-right text-text-2">
                          {volumeFormatter.format(point.v)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                dataKey="c"
                type="natural"
                fill={`url(#${gradientId})`}
                stroke={color}
                strokeWidth={2}
                isAnimationActive
                animationDuration={650}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-border bg-border md:grid-cols-4">
        <Stat
          label="Açılış"
          value={data ? priceFormatter.format(data.first) : "—"}
        />
        <Stat
          label="En Yüksek"
          value={data ? priceFormatter.format(data.high) : "—"}
          tone="bull"
        />
        <Stat
          label="En Düşük"
          value={data ? priceFormatter.format(data.low) : "—"}
          tone="bear"
        />
        <Stat
          label="Hacim"
          value={data ? volumeFormatter.format(data.volume) : "—"}
        />
      </div>
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-text-2 hover:bg-accent hover:text-slate-900 dark:hover:text-white",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Stat({
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
