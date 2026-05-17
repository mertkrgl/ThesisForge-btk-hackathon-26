import { useState, useEffect } from "react";
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
import type { AgentMeta, AgentTone } from "@/lib/mock/types";
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

const TONE_BG: Record<AgentTone, string> = {
  bull: "bg-bull/10 text-bull",
  bear: "bg-bear/10 text-bear",
  warn: "bg-warn/10 text-warn",
  violet: "bg-primary/10 text-primary",
  cyan: "bg-primary/10 text-primary",
  primary: "bg-primary/10 text-primary",
};

const TONE_DOT: Record<AgentTone, string> = {
  bull: "bg-bull",
  bear: "bg-bear",
  warn: "bg-warn",
  violet: "bg-violet",
  cyan: "bg-cyan",
  primary: "bg-primary",
};

export type AgentCardStatus = "idle" | "running" | "done";

export function AgentCard({
  meta,
  status,
  text,
  confidence,
  className,
  wide = false,
}: {
  meta: AgentMeta;
  status: AgentCardStatus;
  text?: string;
  confidence?: number;
  className?: string;
  /** Geniş yatay düzen — sentez ajanı gibi öne çıkan kartlar için. */
  wide?: boolean;
}) {
  const Icon = ICONS[meta.icon] ?? Sparkles;
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const resetTimer = setTimeout(() => {
      setProgress(status === "done" ? 100 : status === "running" ? 10 : 0);
      if (status === "idle") setExpanded(false);
    }, 0);

    if (status === "running") {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + (Math.random() * 10 + 5), 90));
      }, 500);
      return () => {
        clearTimeout(resetTimer);
        clearInterval(interval);
      };
    }

    return () => clearTimeout(resetTimer);
  }, [status]);

  const statusDot = (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "idle" && "bg-line-2",
        status === "running" && "bg-primary",
        status === "done" && TONE_DOT[meta.tone],
      )}
    />
  );

  const statusBody = (
    <>
      {status === "idle" && (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-3 text-[11.5px] text-muted-foreground/70">
          Sırasını bekliyor...
        </div>
      )}

      {status === "running" && (
        <div className="flex h-full flex-col justify-center space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-primary [animation:tf-pulse-dot_1s_ease-in-out_infinite]" />
              Değerlendiriyor...
            </span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex h-full flex-col">
          {!expanded ? (
            <div
              onClick={() => setExpanded(true)}
              className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/35"
            >
              <div
                className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[meta.tone])}
              />
              <span
                className={cn(
                  "font-medium leading-relaxed text-text-2",
                  wide
                    ? "line-clamp-3 text-[13px]"
                    : "line-clamp-2 text-[12px]",
                )}
              >
                {text ? text.replace(/[*#]/g, "") : "Analiz başarıyla tamamlandı."}
              </span>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-lg border border-border bg-muted/25 p-3 font-mono leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap",
                wide ? "text-[12.5px]" : "text-[12px]",
              )}
            >
              {text}
            </div>
          )}

          {text && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10.5px] font-semibold text-primary hover:underline focus:outline-none"
              >
                {expanded ? "Özeti göster" : "Detayı aç"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  const confidenceBlock =
    typeof confidence === "number" ? (
      <div className={cn("border-t border-border", wide ? "mt-4 pt-3" : "mt-4 pt-3")}>
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Komite Katkısı</span>
          <span className="font-mono text-text-2">
            {Math.round(confidence)}%
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    ) : null;

  if (wide) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors md:p-6",
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/40 before:to-transparent",
          status === "running" &&
            "border-primary/50 bg-primary/[0.04] dark:bg-primary/[0.07]",
          status === "done" && "border-primary/30",
          className,
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6">
          <div className="md:w-[280px] md:shrink-0 md:border-r md:border-border md:pr-6">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-xl ring-1 ring-primary/20",
                  TONE_BG[meta.tone],
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Final adım
                </div>
                <div className="mt-0.5 truncate text-[17px] font-bold text-slate-900 dark:text-white">
                  {meta.name}
                </div>
                <div className="truncate text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {meta.role}
                </div>
              </div>
              {statusDot}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-text-2">
              {meta.mandate}
            </p>
            {confidenceBlock}
          </div>
          <div className="flex min-h-[88px] flex-1 flex-col justify-center">
            {statusBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors",
        status === "running" &&
          "border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.06]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg",
            TONE_BG[meta.tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
            {meta.name}
          </div>
          <div className="truncate text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {meta.role}
          </div>
        </div>
        {statusDot}
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-center min-h-[72px]">
        {statusBody}
      </div>

      {confidenceBlock && <div className="mt-auto">{confidenceBlock}</div>}
    </div>
  );
}
