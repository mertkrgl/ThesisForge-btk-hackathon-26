import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getThesis } from "@/lib/api/thesis";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { ConfidenceBar } from "@/components/app/ConfidenceBar";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { SourceChip } from "@/components/app/SourceChip";
import { ThesisExportButtons } from "@/components/app/ThesisExportButtons";
import { VerdictBadge } from "@/components/app/VerdictBadge";
import { DisclaimerBlock } from "@/components/shared/DisclaimerBlock";
import { cn } from "@/lib/utils";
import type { AgentTone, Source, ThesisPoint } from "@/lib/mock/types";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";

const KPI_TONE: Record<AgentTone, string> = {
  bull: "text-bull",
  bear: "text-bear",
  warn: "text-warn",
  violet: "text-violet",
  cyan: "text-cyan",
  primary: "text-primary",
};

export default async function ThesisViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thesis = await getThesis(id);
  if (!thesis) return notFound();

  const date = new Date(thesis.createdAt).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
        <FadeIn>
          <Link
            href="/app/history"
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-2 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tüm tezler
          </Link>
        </FadeIn>

      {/* header */}
      <FadeIn delay={0.05}>
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <CompanyLogo ticker={thesis.ticker} company={thesis.company} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {thesis.ticker}
                  </h1>
                  <VerdictBadge verdict={thesis.verdict} />
                </div>
                <div className="text-[12.5px] text-text-2">
                  {thesis.company} ·{" "}
                  <span className="text-muted-foreground">{thesis.sector}</span>{" "}
                  · <span className="text-muted-foreground">{date}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-text-2">
              {thesis.oneLiner}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="w-[200px]">
              <ConfidenceBar value={thesis.confidence} size="lg" />
            </div>
            <ThesisExportButtons thesis={thesis} date={date} />
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5 md:grid-cols-4">
          {thesis.kpis.map((k) => (
            <div key={k.label}>
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                {k.value}
              </div>
              {k.delta && (
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[11.5px] font-semibold",
                    k.tone ? KPI_TONE[k.tone] : "text-text-2"
                  )}
                >
                  {k.delta}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      </FadeIn>

      {/* bull / bear / catalyst */}
      <FadeIn delay={0.1}>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="Bull"
          tone="bull"
          items={thesis.bull}
          sources={thesis.sources}
        />
        <Column
          title="Bear"
          tone="bear"
          items={thesis.bear}
          sources={thesis.sources}
        />
        <Column
          title="Katalist"
          tone="violet"
          items={thesis.catalysts}
          sources={thesis.sources}
        />
        </div>
      </FadeIn>

      {/* agent breakdown */}
      <FadeIn delay={0.15}>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
            Ajan Kırılımı
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {thesis.agents.length} ajan
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {thesis.agents.map((a) => {
            const meta = AGENT_REGISTRY.find((m) => m.id === a.id);
            if (!meta) return null;
            return (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-900 dark:text-white">
                    {meta.name}
                  </span>
                  <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    {meta.role}
                  </span>
                  <span className="ml-auto font-mono text-[12px] font-bold text-slate-900 dark:text-white">
                    {a.confidence}%
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-text-2">
                  {a.summary}
                </p>
              </div>
            );
          })}
        </div>
        </div>
      </FadeIn>

      {/* citations */}
      <FadeIn delay={0.2}>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">Kaynaklar</h2>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {thesis.sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
              >
                <SourceChip source={s} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-text-2">
                    {s.label}
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <span className="truncate">{s.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </FadeIn>

      <FadeIn delay={0.25}>
        <div className="mt-6">
          <DisclaimerBlock />
        </div>
      </FadeIn>
    </div>
    </PageTransition>
  );
}

function Column({
  title,
  tone,
  items,
  sources,
}: {
  title: string;
  tone: AgentTone;
  items: ThesisPoint[];
  sources: Source[];
}) {
  const TONE_BORDER: Record<AgentTone, string> = {
    bull: "border-bull/30",
    bear: "border-bear/30",
    warn: "border-warn/30",
    violet: "border-violet/30",
    cyan: "border-cyan/30",
    primary: "border-primary/30",
  };
  const TONE_BG: Record<AgentTone, string> = {
    bull: "bg-bull/10 text-bull",
    bear: "bg-bear/10 text-bear",
    warn: "bg-warn/10 text-warn",
    violet: "bg-violet/10 text-violet",
    cyan: "bg-cyan/10 text-cyan",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5",
        TONE_BORDER[tone]
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider",
          TONE_BG[tone]
        )}
      >
        {title}
      </span>
      <ul className="mt-4 flex flex-col gap-3">
        {items.length === 0 && (
          <li className="text-[12.5px] text-muted-foreground">
            Bu kategoride argüman yok.
          </li>
        )}
        {items.map((p, i) => (
          <li
            key={i}
            className="text-[13px] leading-relaxed text-text-2"
          >
            {p.text}
            {p.sources.length > 0 && (
              <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                {p.sources.map((sid) => {
                  const src = sources.find((s) => s.id === sid) ?? {
                    id: sid,
                    kind: "filing" as const,
                  };
                  return <SourceChip key={sid} source={src} />;
                })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
