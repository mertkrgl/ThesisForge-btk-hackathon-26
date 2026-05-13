import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { MOCK_WATCHLIST } from "@/lib/mock/watchlist";
import { Sparkline } from "@/components/app/Sparkline";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Takip
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Watchlist
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-text-2">
            Takip ettiğiniz hisseler ve hızlı tez başlatma.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-4 text-[13px] font-medium text-text-2 transition-colors hover:border-line-2 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Sembol Ekle
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_WATCHLIST.map((w) => {
          const positive = w.deltaPct >= 0;
          return (
            <li
              key={w.ticker}
              className="rounded-2xl border border-line bg-[linear-gradient(180deg,#0C1428,#0A1122)] p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-lg font-bold text-white">
                    {w.ticker}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {w.name}
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold",
                    positive
                      ? "border-bull/30 bg-bull/10 text-[#86EFAC]"
                      : "border-bear/30 bg-bear/10 text-[#FCA5A5]"
                  )}
                >
                  {positive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(w.deltaPct).toFixed(2)}%
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-text-2">
                {w.last.toFixed(2)}
              </div>
              <div className="mt-3 h-[64px]">
                <Sparkline data={w.spark} positive={positive} height={64} />
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
                  href="/app/history"
                  className="text-[11.5px] text-text-2 hover:text-white"
                >
                  Geçmiş tezler →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
