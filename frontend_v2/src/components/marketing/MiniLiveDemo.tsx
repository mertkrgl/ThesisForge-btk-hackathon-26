"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { createMockThesisStream } from "@/lib/mock/stream";
import type { AgentTone } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const TONE_BG: Record<AgentTone, string> = {
  bull: "bg-bull/15 text-[#86EFAC]",
  bear: "bg-bear/15 text-[#FCA5A5]",
  warn: "bg-warn/15 text-warn",
  violet: "bg-violet/15 text-violet",
  cyan: "bg-cyan/15 text-cyan",
  primary: "bg-primary/15 text-[#93C5FD]",
};

const TONE_DOT: Record<AgentTone, string> = {
  bull: "bg-bull",
  bear: "bg-bear",
  warn: "bg-warn",
  violet: "bg-violet",
  cyan: "bg-cyan",
  primary: "bg-primary",
};

const VISIBLE_AGENTS = ["technical", "fundamental", "devil", "synthesizer"];

type AgentState = {
  status: "idle" | "running" | "done";
  text: string;
};

const initialState = (): Record<string, AgentState> =>
  Object.fromEntries(
    VISIBLE_AGENTS.map((id) => [id, { status: "idle", text: "" }])
  );

export function MiniLiveDemo() {
  const [phase, setPhase] = useState("Yönlendirme");
  const [confidence, setConfidence] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [agents, setAgents] =
    useState<Record<string, AgentState>>(initialState);
  const handleRef = useRef<ReturnType<typeof createMockThesisStream> | null>(
    null
  );
  const cycleRef = useRef(0);

  useEffect(() => {
    const start = () => {
      cycleRef.current += 1;
      const cycle = cycleRef.current;
      setPhase("Yönlendirme");
      setConfidence(0);
      setSources([]);
      setAgents(initialState());

      handleRef.current = createMockThesisStream(
        (e) => {
          if (e.type === "phase" && e.phase) setPhase(e.phase);
          if (e.type === "agent_start" && e.agentId) {
            setAgents((prev) =>
              prev[e.agentId!]
                ? { ...prev, [e.agentId!]: { ...prev[e.agentId!], status: "running" } }
                : prev
            );
          }
          if (e.type === "token" && e.agentId && VISIBLE_AGENTS.includes(e.agentId)) {
            setAgents((prev) => ({
              ...prev,
              [e.agentId!]: {
                status: "running",
                text: (prev[e.agentId!]?.text ?? "") + (e.payload as string),
              },
            }));
          }
          if (e.type === "source" && typeof e.payload === "string") {
            setSources((prev) =>
              prev.includes(e.payload as string)
                ? prev
                : [...prev, e.payload as string]
            );
          }
          if (e.type === "confidence" && typeof e.payload === "number") {
            setConfidence(e.payload);
          }
          if (e.type === "agent_done" && e.agentId) {
            setAgents((prev) =>
              prev[e.agentId!]
                ? { ...prev, [e.agentId!]: { ...prev[e.agentId!], status: "done" } }
                : prev
            );
          }
          if (e.type === "done") {
            setTimeout(() => {
              if (cycle === cycleRef.current) start();
            }, 2400);
          }
        },
        { speed: 1.4 }
      );
    };

    start();
    return () => {
      cycleRef.current += 1;
      handleRef.current?.stop();
    };
  }, []);

  return (
    <div className="glass relative w-full overflow-hidden rounded-2xl p-5 shadow-[0_30px_60px_-30px_rgba(59,130,246,0.45)]">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] font-mono text-[12px] font-bold text-slate-900">
            TF
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900">
              TUPRS · Tüpraş
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-bull"
                style={{ animation: "tf-pulse-dot 1.4s ease-in-out infinite" }}
              />
              Faz · {phase}
            </div>
          </div>
        </div>
        <span className="rounded-full border border-line bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-text-2">
          CANLI · DEMO
        </span>
      </div>

      {/* agents */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {VISIBLE_AGENTS.map((id) => {
          const meta = AGENT_REGISTRY.find((a) => a.id === id);
          const st = agents[id];
          if (!meta) return null;
          return (
            <div
              key={id}
              className={cn(
                "rounded-xl border border-line/80 bg-white/80 p-3 transition-all",
                st?.status === "running" &&
                  "ring-1 ring-inset ring-primary/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-1.5 w-1.5 rounded-full",
                    TONE_DOT[meta.tone]
                  )}
                  style={{
                    animation:
                      st?.status === "running"
                        ? "tf-pulse-dot 1.2s ease-in-out infinite"
                        : undefined,
                  }}
                />
                <span className="text-[11.5px] font-semibold text-slate-900">
                  {meta.name}
                </span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-px text-[9.5px] uppercase tracking-wider",
                    TONE_BG[meta.tone]
                  )}
                >
                  {meta.role.split(" ")[0]}
                </span>
              </div>
              <div className="mt-2 min-h-[44px] font-mono text-[11px] leading-relaxed text-text-2">
                {st?.text || (
                  <span className="text-muted-foreground/60">
                    Sırada…
                  </span>
                )}
                {st?.status === "running" && (
                  <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 bg-primary/80 align-middle [animation:tf-pulse-dot_0.9s_ease-in-out_infinite]" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* sources */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Kaynaklar
        </span>
        {sources.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/60">
            henüz yok
          </span>
        ) : (
          sources.map((s) => (
            <span
              key={s}
              className="rounded border border-line bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-[#93C5FD]"
            >
              {s}
            </span>
          ))
        )}
      </div>

      {/* confidence bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Güven Skoru
          </span>
          <span className="font-mono text-[12px] font-semibold text-slate-900">
            {confidence.toString().padStart(2, "0")}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#3B82F6,#A78BFA,#22D3EE)] transition-[width] duration-700 ease-out"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}
