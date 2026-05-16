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
  bull: "bg-bull/12 text-[#86EFAC]",
  bear: "bg-bear/12 text-[#FCA5A5]",
  warn: "bg-warn/12 text-warn",
  violet: "bg-violet/12 text-violet",
  cyan: "bg-cyan/12 text-cyan",
  primary: "bg-primary/12 text-[#93C5FD]",
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
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border bg-white shadow-sm p-4 transition-all",
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
          <div className="truncate text-[13px] font-semibold text-slate-900">
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
          style={{
            animation:
              status === "running"
                ? "tf-pulse-dot 1.2s ease-in-out infinite"
                : undefined,
          }}
        />
      </div>

      <div className="mt-3 min-h-[72px] font-mono text-[12px] leading-relaxed text-text-2">
        {text || (
          <span className="text-muted-foreground/60">
            {status === "idle" ? "Sırada…" : "düşünüyor…"}
          </span>
        )}
        {status === "running" && (
          <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 bg-primary/80 align-middle [animation:tf-pulse-dot_0.9s_ease-in-out_infinite]" />
        )}
      </div>

      {typeof confidence === "number" && (
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>katkı</span>
            <span className="font-mono text-text-2">
              {Math.round(confidence)}%
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line/60">
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
