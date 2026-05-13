import Link from "next/link";
import { Sparkles } from "lucide-react";
import { listTheses } from "@/lib/api/thesis";
import { WatchlistStrip } from "@/components/app/WatchlistStrip";
import { MarketPulse } from "@/components/app/MarketPulse";
import { ThesisCard } from "@/components/app/ThesisCard";
import { AgentActivityFeed } from "@/components/app/AgentActivityFeed";

export default async function DashboardPage() {
  const theses = await listTheses();
  const recent = theses.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Çalışma Alanı
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-text-2">
            Watchlist, son tezler ve komite aktivitesi tek bakışta.
          </p>
        </div>
        <Link
          href="/app/thesis/new"
          className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_10px_25px_-10px_#3B82F6] transition-all hover:bg-[#2563EB]"
        >
          <Sparkles className="h-4 w-4" />
          Yeni Tez
          <span className="ml-1 rounded border border-white/20 bg-white/[0.12] px-1 py-px font-mono text-[10px]">
            ⌘N
          </span>
        </Link>
      </div>

      {/* row 1 */}
      <WatchlistStrip />

      {/* row 2 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <MarketPulse />
        <AgentActivityFeed />
      </div>

      {/* row 3 */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-white">Son Tezler</h2>
          <Link
            href="/app/history"
            className="text-[12px] text-text-2 hover:text-white"
          >
            Tümü →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recent.map((t) => (
            <ThesisCard key={t.id} thesis={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
