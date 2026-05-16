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

const TONE_BORDER: Record<AgentTone, string> = {
  bull: "border-bull/40",
  bear: "border-bear/40",
  warn: "border-warn/40",
  violet: "border-violet/40",
  cyan: "border-cyan/40",
  primary: "border-primary/40",
};

const TONE_BG: Record<AgentTone, string> = {
  bull: "bg-bull/12 text-bull",
  bear: "bg-bear/12 text-bear",
  warn: "bg-warn/12 text-warn",
  violet: "bg-violet/12 text-violet",
  cyan: "bg-cyan/12 text-cyan",
  primary: "bg-primary/12 text-primary",
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
}: {
  meta: AgentMeta;
  status: AgentCardStatus;
  text?: string;
  confidence?: number;
  className?: string;
}) {
  const Icon = ICONS[meta.icon] ?? Sparkles;
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === "running") {
      setProgress(10);
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + (Math.random() * 10 + 5), 90));
      }, 500);
      return () => clearInterval(interval);
    } else if (status === "done") {
      setProgress(100);
    } else {
      setProgress(0);
      setExpanded(false);
    }
  }, [status]);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all",
        TONE_BORDER[meta.tone],
        status === "running" &&
          "shadow-[0_0_0_3px_rgba(59,130,246,0.10)] ring-1 ring-inset ring-primary/40",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg",
            TONE_BG[meta.tone]
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
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            status === "idle" ? "bg-line-2" : TONE_DOT[meta.tone]
          )}
        />
      </div>

      <div className="mt-4 flex-1 flex flex-col justify-center min-h-[72px]">
        {status === "idle" && (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11.5px] text-muted-foreground/70">
            Sırasını bekliyor...
          </div>
        )}

        {status === "running" && (
          <div className="flex h-full flex-col justify-center space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary [animation:tf-pulse-dot_1s_ease-in-out_infinite]" />
                Veriler sentezleniyor...
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
                 className={cn(
                   "flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-3 border transition-colors hover:bg-opacity-80",
                   TONE_BG[meta.tone].replace("text-", "border-").replace("/12", "/20 bg-opacity-30")
                 )}
               >
                 <div className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[meta.tone])} />
                 <span className="line-clamp-2 text-[12px] font-medium leading-relaxed opacity-90">
                   {text ? text.replace(/[*#]/g, '') : "Analiz başarıyla tamamlandı."}
                 </span>
               </div>
            ) : (
               <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 font-mono text-[12px] leading-relaxed text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">
                 {text}
               </div>
            )}
            
            {text && (
              <div className="mt-3 text-center">
                <button 
                  onClick={() => setExpanded(!expanded)}
                  className="text-[10.5px] font-semibold text-primary hover:underline focus:outline-none"
                >
                  {expanded ? "▲ Özeti Göster" : "▼ Detaylı Analizi Oku"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {typeof confidence === "number" && (
        <div className="mt-auto pt-3 border-t border-border mt-4">
          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>Komite Katkısı</span>
            <span className="font-mono text-text-2">
              {Math.round(confidence)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/60">
            <div
              className={cn("h-full rounded-full", TONE_DOT[meta.tone])}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
