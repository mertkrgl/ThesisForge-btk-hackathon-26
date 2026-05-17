"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import { listWatchlist } from "@/lib/api/watchlist";
import type { WatchlistItem } from "@/lib/mock/types";

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Veri yok";
  return priceFormatter.format(value);
}

export function WatchlistStrip() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWatchlist()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Watchlist alınamadı");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          Watchlist
        </h2>
        <Link
          href="/app/watchlist"
          className="text-[11.5px] text-text-2 hover:text-slate-900 dark:hover:text-white"
        >
          Tümü →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[78px] animate-pulse rounded-xl border border-border bg-card/60"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-bear/30 bg-bear/10 p-3 text-[12px] text-bear">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 p-4 text-center text-[12px] text-text-2">
          Henüz watchlist&apos;inde sembol yok.{" "}
          <Link
            href="/app/watchlist"
            className="font-semibold text-primary hover:underline"
          >
            Sembol ekle →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {items.map((w) => {
            const hasQuote = w.last != null && w.deltaPct != null;
            const positive = (w.deltaPct ?? 0) >= 0;
            return (
              <li key={w.ticker}>
                <Link
                  href={`/app/watchlist/${w.ticker}`}
                  className="block rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <CompanyLogo
                        ticker={w.ticker}
                        company={w.name}
                        size="sm"
                      />
                      <span className="font-mono text-[13px] font-bold text-slate-900 dark:text-white">
                        {w.ticker}
                      </span>
                    </div>
                    {hasQuote ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold",
                          positive ? "text-bull" : "text-bear",
                        )}
                      >
                        {positive ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(w.deltaPct ?? 0).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="rounded-md border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
                        Veri yok
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[14.5px] font-bold text-text-2">
                    {formatPrice(w.last)}
                  </div>
                  <div className="mt-1">
                    {hasQuote && w.spark.length > 1 ? (
                      <Sparkline
                        data={w.spark}
                        positive={positive}
                        height={28}
                      />
                    ) : (
                      <div className="h-7 rounded-md border border-dashed border-border bg-card/50" />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
