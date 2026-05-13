import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MOCK_WATCHLIST } from "@/lib/mock/watchlist";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";

export function WatchlistStrip() {
  return (
    <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,#0C1428,#0A1122)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-white">Watchlist</h2>
        <Link
          href="/app/watchlist"
          className="text-[11.5px] text-text-2 hover:text-white"
        >
          Tümü →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {MOCK_WATCHLIST.map((w) => {
          const positive = w.deltaPct >= 0;
          return (
            <li key={w.ticker}>
              <Link
                href={`/app/thesis/new?symbol=${w.ticker}`}
                className="block rounded-xl border border-line bg-[#0A1122] p-3 transition-colors hover:border-line-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] font-bold text-white">
                    {w.ticker}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold",
                      positive ? "text-[#86EFAC]" : "text-[#FCA5A5]"
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
                <div className="mt-1 font-mono text-[14.5px] font-bold text-text-2">
                  {w.last.toFixed(2)}
                </div>
                <div className="mt-1">
                  <Sparkline data={w.spark} positive={positive} height={28} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
