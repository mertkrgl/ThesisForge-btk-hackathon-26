"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { Sparkline } from "@/components/app/Sparkline";
import { cn } from "@/lib/utils";
import {
  PageTransition,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/MotionWrappers";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "@/lib/api/watchlist";
import type { WatchlistItem } from "@/lib/mock/types";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listWatchlist();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Watchlist alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = newSymbol.trim().toUpperCase();
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      await addToWatchlist(t);
      setNewSymbol("");
      setAddOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setBusy(true);
    try {
      await removeFromWatchlist(ticker);
      setItems((prev) => prev.filter((x) => x.ticker !== ticker));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
        <FadeIn>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Takip
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Watchlist
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] text-text-2">
                Takip ettiğiniz hisseler ve hızlı tez başlatma.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-accent/50 px-4 text-[13px] font-medium text-text-2 transition-colors hover:border-border hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Sembol Ekle
            </button>
          </div>
        </FadeIn>

        {error && (
          <div className="mb-4 rounded-lg border border-bear/30 bg-bear/10 p-3 text-[13px] text-bear">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[200px] animate-pulse rounded-2xl border border-border bg-card/60"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-[14px] text-text-2">
              Henüz takip ettiğin sembol yok.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-[#2563EB]"
            >
              <Plus className="h-4 w-4" />
              İlk sembolünü ekle
            </button>
          </div>
        ) : (
          <StaggerContainer
            stagger={0.08}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((w) => {
              const positive = w.deltaPct >= 0;
              return (
                <StaggerItem key={w.ticker}>
                  <li className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyLogo
                          ticker={w.ticker}
                          company={w.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                            {w.ticker}
                          </div>
                          <div className="truncate text-[12px] text-muted-foreground">
                            {w.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                          {Math.abs(w.deltaPct).toFixed(2)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(w.ticker)}
                          disabled={busy}
                          className="rounded-md p-1 text-text-2 transition-colors hover:bg-bear/10 hover:text-bear disabled:opacity-40"
                          title="Watchlist'ten çıkar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-bold text-text-2">
                      {w.last.toFixed(2)}
                    </div>
                    <div className="mt-3 h-[64px]">
                      <Sparkline
                        data={w.spark}
                        positive={positive}
                        height={64}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/app/thesis/new?symbol=${w.ticker}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Tez Başlat
                      </Link>
                      <Link
                        href={`/app/history?ticker=${w.ticker}`}
                        className="text-[11.5px] text-text-2 hover:text-white"
                      >
                        Geçmiş tezler →
                      </Link>
                    </div>
                  </li>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAdd}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                Yeni sembol ekle
              </h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md p-1 text-text-2 hover:bg-accent hover:text-white"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label
              htmlFor="ticker-input"
              className="mb-2 block text-[11.5px] uppercase tracking-wider text-muted-foreground"
            >
              BIST sembolü
            </label>
            <input
              id="ticker-input"
              autoFocus
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="ASELS"
              className="h-11 w-full rounded-lg border border-border bg-card px-3 font-mono text-[14px] font-semibold uppercase tracking-wider text-slate-900 dark:text-white focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="h-10 rounded-lg border border-border bg-transparent px-4 text-[13px] font-medium text-text-2 hover:text-white"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={!newSymbol.trim() || busy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-[#2563EB] disabled:opacity-50"
              >
                Ekle
              </button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
