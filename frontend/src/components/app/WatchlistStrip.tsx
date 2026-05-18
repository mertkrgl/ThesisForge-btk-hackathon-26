"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import { listWatchlist } from "@/lib/api/watchlist";
import { useAuth } from "@/lib/auth/AuthProvider";
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!isAuthenticated) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return;
    }
    listWatchlist()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Liste alınamadı");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  return (
    <div
      data-tour="dashboard-watchlist"
      className="rounded-2xl border border-border bg-card p-4"
    >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
            Takip Edilen Hisseler
          </h2>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <Link
                href="/app/companies"
                className="grid h-6 w-6 place-items-center rounded-md border border-border bg-card text-text-2 transition-colors hover:border-primary/40 hover:text-primary"
                title="Hisse ekle"
                aria-label="Hisse ekle"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            )}
            <Link
              href="/app/watchlist"
              className="text-[11.5px] text-text-2 hover:text-slate-900 dark:hover:text-white"
            >
              Tümü →
            </Link>
          </div>
        </div>
        {loading ? (
          <div
            className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col grid-rows-2 gap-2 min-w-max">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[78px] animate-pulse rounded-xl border border-border bg-card/60"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-bear/30 bg-bear/10 p-3 text-[12px] text-bear">
            {error}
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-lg border border-dashed border-border bg-card/60 p-4 text-center text-[12px] text-text-2">
            Takip listesini görüntülemek için{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              giriş yapın →
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/60 p-4 text-center text-[12px] text-text-2">
            Henüz takip ettiğin hisse yok.{" "}
            <Link
              href="/app/companies"
              className="font-semibold text-primary hover:underline"
            >
              Hisse ekle →
            </Link>
          </div>
        ) : (
          <div
            className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
            style={{ scrollbarWidth: "thin" }}
          >
            <ul className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col grid-rows-2 gap-2 min-w-max">
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
          </div>
        )}
    </div>
  );
}
