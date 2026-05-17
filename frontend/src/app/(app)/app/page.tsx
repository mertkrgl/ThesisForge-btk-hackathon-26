import Link from "next/link";
import { Sparkles } from "lucide-react";
import { listTheses } from "@/lib/api/thesis";
import { WatchlistStrip } from "@/components/app/WatchlistStrip";
import { ThesisCard } from "@/components/app/ThesisCard";
import { MarketPulse } from "@/components/app/MarketPulse";
import { AgentActivityFeed } from "@/components/app/AgentActivityFeed";
import {
  PageTransition,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/MotionWrappers";
import type { Thesis } from "@/lib/mock/types";

export default async function DashboardPage() {
  let theses: Thesis[] = [];
  try {
    theses = await listTheses();
  } catch {
    theses = [];
  }
  const recent = theses.slice(0, 4);

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1440px] px-6 py-8">
        <FadeIn>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Çalışma Alanı
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] text-text-2">
                Watchlist, son tezler ve komite aktivitesi tek bakışta.
              </p>
            </div>
            <Link
              href="/app/thesis/live"
              className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_10px_25px_-10px_#3B82F6] transition-all hover:bg-[#2563EB]"
            >
              <Sparkles className="h-4 w-4" />
              Yeni Tez
              <span className="ml-1 rounded border border-white/20 bg-white/[0.12] px-1 py-px font-mono text-[10px]">
                ⌘N
              </span>
            </Link>
          </div>
        </FadeIn>

        {/* row 1 */}
        <FadeIn delay={0.1}>
          <WatchlistStrip />
        </FadeIn>

        {/* row 2: Static Layout */}
        <FadeIn delay={0.2}>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              <MarketPulse />
            </div>
            <div className="md:col-span-5">
              <AgentActivityFeed />
            </div>
          </div>
        </FadeIn>

        {/* row 3 */}
        <FadeIn delay={0.3}>
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white">Son Tezler</h2>
              <Link
                href="/app/history"
                className="text-[12px] text-text-2 hover:text-white"
              >
                Tümü →
              </Link>
            </div>
            <StaggerContainer
              stagger={0.08}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {recent.map((t) => (
                <StaggerItem key={t.id}>
                  <ThesisCard thesis={t} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}

