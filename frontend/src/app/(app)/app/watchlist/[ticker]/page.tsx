import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, History, Sparkles } from "lucide-react";
import { CompanyFeed } from "@/components/app/CompanyFeed";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { PriceChartCard } from "@/components/app/PriceChartCard";
import { fetchMarketQuote } from "@/lib/api/market";
import { companyName } from "@/lib/data/companyNames";
import { cn } from "@/lib/utils";
import { FadeIn, PageTransition } from "@/components/shared/MotionWrappers";

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function WatchlistTickerDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  if (!/^[A-Z0-9.\-^]{1,12}$/.test(ticker)) {
    return notFound();
  }

  const name = companyName(ticker);

  let quote;
  try {
    quote = await fetchMarketQuote(ticker);
  } catch {
    return notFound();
  }

  const positive = quote.delta_pct >= 0;
  const deltaAbs = quote.last - quote.previous_close;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <Link
            href="/app/watchlist"
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-2 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Watchlist
          </Link>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                <CompanyLogo ticker={ticker} company={name} size="lg" />
                <div className="min-w-0">
                  <h1 className="font-mono text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {ticker}
                  </h1>
                  <div className="mt-0.5 text-[13px] text-text-2">{name}</div>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white">
                  {priceFormatter.format(quote.last)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[12px] font-semibold",
                      positive
                        ? "border-bull/30 bg-bull/10 text-bull"
                        : "border-bear/30 bg-bear/10 text-bear",
                    )}
                  >
                    {positive ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {positive ? "+" : "−"}
                    {priceFormatter.format(Math.abs(deltaAbs))} (
                    {Math.abs(quote.delta_pct).toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  Önceki kapanış: {priceFormatter.format(quote.previous_close)}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-6">
            <PriceChartCard ticker={ticker} initialPeriod="1w" />
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/app/thesis/live?symbol=${ticker}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
            >
              <Sparkles className="h-4 w-4" />
              Tez Başlat
            </Link>
            <Link
              href={`/app/history?ticker=${ticker}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-text-2 transition-colors hover:text-white"
            >
              <History className="h-4 w-4" />
              Geçmiş Tezler
            </Link>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6">
            <CompanyFeed ticker={ticker} />
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
