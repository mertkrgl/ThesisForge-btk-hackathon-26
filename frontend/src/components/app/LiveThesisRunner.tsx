"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Play, RotateCcw, Sparkles } from "lucide-react";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { streamThesis } from "@/lib/api/thesis";
import type { StreamEvent } from "@/lib/mock/types";
import { AgentCard, type AgentCardStatus } from "./AgentCard";
import { ConfidenceBar } from "./ConfidenceBar";
import { SourceChip } from "./SourceChip";
import { Stepper } from "./Stepper";
import { cn } from "@/lib/utils";
import {
  PageTransition,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/MotionWrappers";

type AgentState = {
  status: AgentCardStatus;
  text: string;
  confidence?: number;
};

type PhaseId =
  | "Hazırlanıyor"
  | "Veri Toplanıyor"
  | "Ajanlar Değerlendiriyor"
  | "Sentezleniyor"
  | "Tez Hazır";

const STEPS = [
  { id: "Hazırlanıyor", label: "Hazırlanıyor" },
  { id: "Veri Toplanıyor", label: "Veri Toplanıyor" },
  { id: "Ajanlar Değerlendiriyor", label: "Ajanlar" },
  { id: "Sentezleniyor", label: "Sentez" },
  { id: "Tez Hazır", label: "Tez Hazır" },
];

const POPULAR = ["TUPRS", "ASELS", "EREGL", "THYAO", "BIMAS"];

const PHASE_COPY: Record<PhaseId, { title: string; body: string }> = {
  Hazırlanıyor: {
    title: "Komite hazırlanıyor",
    body: "Sembol, strateji ve soru bilgisi kontrol ediliyor.",
  },
  "Veri Toplanıyor": {
    title: "Veriler toplanıyor",
    body: "KAP, fiyat, haber ve geçmiş tez kaynakları düzenleniyor.",
  },
  "Ajanlar Değerlendiriyor": {
    title: "Ajanlar değerlendiriyor",
    body: "Analistler kısa özetlerini üretirken ekranı sakin tutuyoruz.",
  },
  Sentezleniyor: {
    title: "Komite sentezi yazılıyor",
    body: "Bull, bear, katalist ve risk argümanları tek teze indirgeniyor.",
  },
  "Tez Hazır": {
    title: "Tez hazır",
    body: "Komite sonucu görüntülemeye hazır. İstersen detaylı tezi açabilirsin.",
  },
};

function normalizePhase(phase?: string): PhaseId {
  if (phase === "Yönlendirme") return "Veri Toplanıyor";
  if (phase === "Müzakere") return "Ajanlar Değerlendiriyor";
  if (phase === "Sentez") return "Sentezleniyor";
  if (phase === "Hazır") return "Tez Hazır";
  if (phase && phase in PHASE_COPY) return phase as PhaseId;
  return "Hazırlanıyor";
}

const initAgents = (): Record<string, AgentState> =>
  Object.fromEntries(
    AGENT_REGISTRY.map((a) => [a.id, { status: "idle", text: "" }])
  );

export function LiveThesisRunner({
  defaultSymbol = "TUPRS",
  title = "Yeni Tez",
  subtitle = "Canlı Komite",
  autoStart = false,
}: {
  defaultSymbol?: string;
  title?: string;
  subtitle?: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseId>("Hazırlanıyor");
  const [confidence, setConfidence] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentState>>(initAgents);
  const [done, setDone] = useState(false);
  const handleRef = useRef<{ stop: () => void } | null>(null);

  const start = () => {
    handleRef.current?.stop();
    setRunning(true);
    setDone(false);
    setPhase("Hazırlanıyor");
    setConfidence(0);
    setSources([]);
    setAgents(initAgents());

    handleRef.current = streamThesis(
      { ticker: symbol, question: question || undefined },
      (e: StreamEvent) => {
        if (e.type === "phase" && e.phase) setPhase(normalizePhase(e.phase));
        if (e.type === "agent_start" && e.agentId) {
          setPhase(
            e.agentId === "synthesizer"
              ? "Sentezleniyor"
              : "Ajanlar Değerlendiriyor"
          );
          setAgents((p) =>
            p[e.agentId!]
              ? { ...p, [e.agentId!]: { ...p[e.agentId!], status: "running" } }
              : p
          );
        }
        if (e.type === "token" && e.agentId) {
          setAgents((p) => ({
            ...p,
            [e.agentId!]: {
              status: "running",
              text: (p[e.agentId!]?.text ?? "") + (e.payload as string),
              confidence: p[e.agentId!]?.confidence,
            },
          }));
        }
        if (e.type === "source" && typeof e.payload === "string") {
          setPhase((p) => (p === "Hazırlanıyor" ? "Veri Toplanıyor" : p));
          setSources((p) =>
            p.includes(e.payload as string) ? p : [...p, e.payload as string]
          );
        }
        if (e.type === "confidence" && typeof e.payload === "number") {
          setConfidence(e.payload);
          // also attribute confidence to last running agent for the cards
          setAgents((p) => {
            const next = { ...p };
            for (const id of Object.keys(next)) {
              if (next[id].status === "running" && next[id].confidence === undefined) {
                next[id] = { ...next[id], confidence: e.payload as number };
              }
            }
            return next;
          });
        }
        if (e.type === "agent_done" && e.agentId) {
          setAgents((p) =>
            p[e.agentId!]
              ? { ...p, [e.agentId!]: { ...p[e.agentId!], status: "done" } }
              : p
          );
        }
        if (e.type === "done") {
          setPhase("Tez Hazır");
          setDone(true);
          setRunning(false);
          setAgents((p) =>
            Object.fromEntries(
              AGENT_REGISTRY.map((a) => [
                a.id,
                { ...p[a.id], status: "done", text: p[a.id]?.text ?? "" },
              ])
            )
          );
        }
      }
    );
  };

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (autoStart) {
      // UI yüklendikten hemen sonra başlatmak için ufak bir gecikme
      t = setTimeout(() => start(), 300);
    }
    return () => {
      if (t) clearTimeout(t);
      handleRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const finishedAgents = useMemo(
    () => Object.values(agents).filter((a) => a.status === "done").length,
    [agents]
  );

  const runningAgents = useMemo(
    () =>
      AGENT_REGISTRY.filter((a) => agents[a.id]?.status === "running").map(
        (a) => a.name
      ),
    [agents]
  );

  const phaseProgress = done
    ? 100
    : Math.min(
        94,
        Math.round(((finishedAgents + (runningAgents.length ? 0.45 : 0)) / 8) * 100)
      );

  const openViewer = () => {
    // demo: viewer always shows TUPRS thesis
    router.push("/app/thesis/th_tuprs_20260513");
  };

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1440px] px-6 py-8">
        <FadeIn>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                {subtitle}
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] text-text-2">
                Sembolü ve isteğe bağlı soruyu girin; komite ilerlerken sadece
                gerekli durum bilgilerini gösteriyoruz.
              </p>
            </div>
            <Stepper steps={STEPS} current={phase} />
          </div>
        </FadeIn>

      {/* control row */}
      <FadeIn delay={0.05}>
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[180px_1fr_auto]">
          <SymbolPicker value={symbol} onChange={setSymbol} disabled={running} />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Örn: ${symbol} için 4Ç katalist takvimi nasıl?`}
            disabled={running}
            className="h-11 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 text-[13px] text-foreground dark:text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 disabled:opacity-60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={start}
              disabled={running}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <span
                    className="h-2 w-2 rounded-full bg-card"
                    style={{ animation: "tf-pulse-dot 1.2s ease-in-out infinite" }}
                  />
                  Komite çalışıyor…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Komiteyi Başlat
                </>
              )}
            </button>
            {done && (
              <button
                type="button"
                onClick={start}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 dark:border-border bg-card dark:bg-accent/50 px-3 text-[13px] font-medium text-slate-600 dark:text-text-2 transition-colors hover:border-slate-300 dark:hover:border-border hover:text-slate-900 dark:hover:text-white"
                title="Yeniden çalıştır"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <PhasePanel
          phase={phase}
          symbol={symbol}
          running={running}
          done={done}
          progress={phaseProgress}
          runningAgents={runningAgents}
          finishedAgents={finishedAgents}
        />
      </FadeIn>

      {/* main */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <FadeIn delay={0.1}>
          <StaggerContainer stagger={0.05} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {AGENT_REGISTRY.map((meta) => (
              <StaggerItem key={meta.id}>
                <AgentCard
                  meta={meta}
                  status={agents[meta.id]?.status ?? "idle"}
                  text={agents[meta.id]?.text}
                  confidence={agents[meta.id]?.confidence}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>

          {done && (
            <FadeIn>
              <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-bull" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Sentez
                  </span>
                </div>
                <h3 className="mt-3 text-[18px] font-bold text-slate-900 dark:text-white">
                  {symbol} · Komite Sentezi
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">
                  Bull argümanları (FAVÖK toparlanması, düşük kaldıraç) ile bear
                  argümanları (global spread riski) dengelendi. Katalist takvimi
                  pozitif yönde ağır basıyor.{" "}
                  <span className="text-slate-900 dark:text-white">Net pozisyon: tutmaya değer.</span>
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openViewer}
                    className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-all hover:bg-[#2563EB]"
                  >
                    Tezi Görüntüle
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <Link
                    href="/app/history"
                    className="text-[12px] text-text-2 hover:text-slate-900 dark:hover:text-white"
                  >
                    Geçmiş tezlere ekle →
                  </Link>
                </div>
              </div>
            </FadeIn>
          )}
        </FadeIn>

        {/* side rail */}
        <FadeIn delay={0.15}>
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <ConfidenceBar value={confidence} size="lg" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-[11.5px]">
                <SideStat label="Faz" value={phase} />
                <SideStat label="Tamamlanan" value={`${finishedAgents}/8`} />
                <SideStat label="Kaynak" value={`${sources.length}`} />
                <SideStat label="Sembol" value={symbol} mono />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Toplanan Kaynaklar
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sources.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground/70">
                    henüz yok
                  </span>
                ) : (
                  sources.map((s) => (
                    <SourceChip key={s} source={{ id: s, kind: "filing" }} />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 text-[11.5px] leading-relaxed text-text-2">
              <span className="font-semibold text-slate-900 dark:text-white">Demo modu.</span> Bu
              akış demo modunda mock veriyle çalışıyor. Backend bağlandığında
              aynı bileşenler gerçek tez akışını işleyecek.
            </div>
          </aside>
        </FadeIn>
      </div>
    </div>
    </PageTransition>
  );
}

function PhasePanel({
  phase,
  symbol,
  running,
  done,
  progress,
  runningAgents,
  finishedAgents,
}: {
  phase: PhaseId;
  symbol: string;
  running: boolean;
  done: boolean;
  progress: number;
  runningAgents: string[];
  finishedAgents: number;
}) {
  const copy = PHASE_COPY[phase];
  const activeText =
    runningAgents.length > 0
      ? runningAgents.slice(0, 2).join(", ")
      : done
        ? "Komite tamamlandı"
        : running
          ? "Süreç başlatılıyor"
          : "Başlatmaya hazır";

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
              done
                ? "border-bull/25 bg-bull/10 text-bull"
                : "border-primary/20 bg-primary/10 text-primary"
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                {copy.title}
              </h2>
              <span className="rounded-md border border-border bg-muted/25 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {symbol}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
              {copy.body}
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 md:w-[320px]">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{activeText}</span>
            <span className="font-mono">{finishedAgents}/8</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SideStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-semibold text-slate-900 dark:text-white",
          mono ? "font-mono text-[14px]" : "text-[13px]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SymbolPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        disabled={disabled}
        placeholder="TUPRS"
        className="h-11 w-full rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 font-mono text-[14px] font-semibold uppercase tracking-wider text-foreground dark:text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 disabled:opacity-60"
      />
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 hidden flex-wrap gap-1 group-focus-within:flex">
        {POPULAR.filter((p) => p !== value).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="rounded border border-slate-200 dark:border-border bg-slate-100 dark:bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-slate-500 dark:text-text-2 hover:text-slate-900 dark:hover:text-white"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
