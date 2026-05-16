import {
  LineChart,
  Calculator,
  ShieldAlert,
  Sparkles,
  History,
  Zap,
  Radio,
  AlertTriangle,
} from "lucide-react";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import type { AgentTone } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LineChart,
  Calculator,
  ShieldAlert,
  Sparkles,
  History,
  Zap,
  Radio,
  AlertTriangle,
};

const TONE_GLOW: Record<AgentTone, string> = {
  bull: "group-hover:shadow-[0_30px_60px_-30px_rgba(34,197,94,0.55)]",
  bear: "group-hover:shadow-[0_30px_60px_-30px_rgba(239,68,68,0.55)]",
  warn: "group-hover:shadow-[0_30px_60px_-30px_rgba(245,158,11,0.55)]",
  violet: "group-hover:shadow-[0_30px_60px_-30px_rgba(167,139,250,0.55)]",
  cyan: "group-hover:shadow-[0_30px_60px_-30px_rgba(34,211,238,0.55)]",
  primary: "group-hover:shadow-[0_30px_60px_-30px_rgba(59,130,246,0.55)]",
};

const TONE_BG: Record<AgentTone, string> = {
  bull: "bg-bull/12 text-[#86EFAC] border-bull/30",
  bear: "bg-bear/12 text-[#FCA5A5] border-bear/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  violet: "bg-violet/12 text-violet border-violet/30",
  cyan: "bg-cyan/12 text-cyan border-cyan/30",
  primary: "bg-primary/12 text-[#93C5FD] border-primary/30",
};

export function AgentShowcase() {
  return (
    <section id="ajanlar" className="relative border-b border-line/60">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Komite"
          title="8 ajan. Tek bir gerekçeli tez."
          subtitle="Her ajanın bir mandası, bir görüş alanı ve bir güven katkısı var. Birbirleriyle çelişebilir, sentez katmanı bunu kalibre eder."
        />

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_REGISTRY.map((agent) => {
            const Icon = ICONS[agent.icon] ?? Sparkles;
            return (
              <div
                key={agent.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:border-line-2",
                  TONE_GLOW[agent.tone]
                )}
              >
                <div
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl border",
                    TONE_BG[agent.tone]
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="mt-4 text-[14px] font-semibold text-slate-900">
                  {agent.name}
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-[10.5px] uppercase tracking-[0.14em]",
                    agent.tone === "bull"
                      ? "text-[#86EFAC]"
                      : agent.tone === "bear"
                        ? "text-[#FCA5A5]"
                        : agent.tone === "warn"
                          ? "text-warn"
                          : agent.tone === "violet"
                            ? "text-violet"
                            : agent.tone === "cyan"
                              ? "text-cyan"
                              : "text-[#93C5FD]"
                  )}
                >
                  {agent.role}
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-text-2">
                  {agent.mandate}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet">
        {kicker}
      </div>
      <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-text-2">{subtitle}</p>
    </div>
  );
}
