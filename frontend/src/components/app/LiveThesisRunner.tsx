"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Gauge,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { AGENT_COUNT, AGENT_REGISTRY } from "@/lib/mock/agents";
import { streamThesis } from "@/lib/api/thesis";
import type { StreamEvent } from "@/lib/mock/types";
import { AgentCard, type AgentCardStatus } from "./AgentCard";
import { SourceChip } from "./SourceChip";
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

type Persona = "default" | "conservative";

const POPULAR = ["TUPRS", "ASELS", "EREGL", "THYAO", "BIMAS", "GARAN"];

const PHASES: { id: PhaseId; label: string }[] = [
  { id: "Hazırlanıyor", label: "Hazırlık" },
  { id: "Veri Toplanıyor", label: "Veri" },
  { id: "Ajanlar Değerlendiriyor", label: "Komite" },
  { id: "Sentezleniyor", label: "Sentez" },
  { id: "Tez Hazır", label: "Hazır" },
];

const PERSONA_COPY: Record<
  Persona,
  { label: string; compact: string; body: string }
> = {
  default: {
    label: "Dengeli Analiz",
    compact: "Dengeli",
    body: "Bull ve bear argümanları aynı ağırlıkta değerlendirilir.",
  },
  conservative: {
    label: "Muhafazakar",
    compact: "Muhafazakar",
    body: "Riskler ve aşağı yönlü senaryolar daha görünür tutulur.",
  },
};

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
    body: "Analistler paralel çalışıyor.",
  },
  Sentezleniyor: {
    title: "Komite sentezi yazılıyor",
    body: "Bull, bear, katalist ve risk argümanları tek teze indirgeniyor.",
  },
  "Tez Hazır": {
    title: "Tez hazır",
    body: "Komite sonucu görüntülemeye hazır.",
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
    AGENT_REGISTRY.map((a) => [a.id, { status: "idle", text: "" }]),
  );

export function LiveThesisRunner({
  defaultSymbol = "",
  defaultPersona = "default",
  title = "Canlı Komite",
  subtitle = "Yeni Tez",
  autoStart = false,
}: {
  defaultSymbol?: string;
  defaultPersona?: Persona;
  title?: string;
  subtitle?: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseId>("Hazırlanıyor");
  const [confidence, setConfidence] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentState>>(initAgents);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thesisId, setThesisId] = useState<string | null>(null);
  const handleRef = useRef<{ stop: () => void } | null>(null);

  const start = (overrideSymbol?: string) => {
    const sym = (overrideSymbol ?? symbol).trim().toUpperCase();
    if (!sym) return;
    handleRef.current?.stop();
    setSymbol(sym);
    setRunning(true);
    setDone(false);
    setError(null);
    setThesisId(null);
    setPhase("Hazırlanıyor");
    setConfidence(0);
    setSources([]);
    setAgents(initAgents());

    handleRef.current = streamThesis(
      {
        symbol: sym,
        persona,
        question: question || undefined,
      },
      {
        onMeta: ({ thesisId: tid }) => setThesisId(tid),
        onError: (msg) => {
          setError(msg);
          setRunning(false);
        },
        onEvent: (e: StreamEvent) => {
          if (e.type === "phase" && e.phase) setPhase(normalizePhase(e.phase));
          if (e.type === "agent_start" && e.agentId) {
            setPhase(
              e.agentId === "synthesizer"
                ? "Sentezleniyor"
                : "Ajanlar Değerlendiriyor",
            );
            setAgents((p) =>
              p[e.agentId!]
                ? { ...p, [e.agentId!]: { ...p[e.agentId!], status: "running" } }
                : p,
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
              p.includes(e.payload as string) ? p : [...p, e.payload as string],
            );
          }
          if (e.type === "confidence" && typeof e.payload === "number") {
            setConfidence(e.payload);
            setAgents((p) => {
              const next = { ...p };
              for (const id of Object.keys(next)) {
                if (
                  next[id].status === "running" &&
                  next[id].confidence === undefined
                ) {
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
                : p,
            );
          }
          if (e.type === "done") {
            setPhase("Tez Hazır");
            setDone(true);
            setRunning(false);
            if (typeof e.payload === "string") setThesisId(e.payload);
            setAgents((p) =>
              Object.fromEntries(
                AGENT_REGISTRY.map((a) => [
                  a.id,
                  { ...p[a.id], status: "done", text: p[a.id]?.text ?? "" },
                ]),
              ),
            );
          }
        },
      },
    );
  };

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (autoStart && defaultSymbol) {
      t = setTimeout(() => start(defaultSymbol), 300);
    }
    return () => {
      if (t) clearTimeout(t);
      handleRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, defaultSymbol]);

  const finishedAgents = useMemo(
    () => Object.values(agents).filter((a) => a.status === "done").length,
    [agents],
  );

  const runningAgents = useMemo(
    () =>
      AGENT_REGISTRY.filter((a) => agents[a.id]?.status === "running").map(
        (a) => a.name,
      ),
    [agents],
  );

  const visibleAgents = useMemo(
    () =>
      AGENT_REGISTRY.filter((a) => done || agents[a.id]?.status !== "idle"),
    [agents, done],
  );

  const queuedAgents = useMemo(
    () =>
      AGENT_REGISTRY.filter((a) => agents[a.id]?.status === "idle").map(
        (a) => a.name,
      ),
    [agents],
  );

  const phaseProgress = done
    ? 100
    : Math.min(
        94,
        Math.round(
          ((finishedAgents + (runningAgents.length ? 0.45 : 0)) / AGENT_COUNT) *
            100,
        ),
      );

  const openViewer = () => {
    if (thesisId) router.push(`/app/thesis/${thesisId}`);
    else router.push("/app/history");
  };

  const reset = () => {
    handleRef.current?.stop();
    setRunning(false);
    setDone(false);
    setError(null);
    setThesisId(null);
    setPhase("Hazırlanıyor");
    setConfidence(0);
    setSources([]);
    setAgents(initAgents());
  };

  // ───── 3 aşamalı state ─────
  const state: "idle" | "running" | "done" =
    done ? "done" : running ? "running" : "idle";

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] px-5 py-7 sm:px-6">
        {error && (
          <FadeIn>
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-bear/30 bg-bear/10 p-4 text-[13px] text-bear">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Bir sorun oluştu</div>
                <p className="mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          </FadeIn>
        )}

        {state === "idle" && (
          <IdleHero
            title={title}
            subtitle={subtitle}
            symbol={symbol}
            setSymbol={setSymbol}
            persona={persona}
            setPersona={setPersona}
            question={question}
            setQuestion={setQuestion}
            onStart={() => start()}
          />
        )}

        {(state === "running" || state === "done") && (
          <>
            <FadeIn>
              <RunHeader
                symbol={symbol}
                persona={persona}
                phase={phase}
                progress={phaseProgress}
                running={state === "running"}
                done={state === "done"}
                finishedAgents={finishedAgents}
                totalAgents={AGENT_COUNT}
                confidence={confidence}
                sourceCount={sources.length}
                runningAgents={runningAgents}
                onRestart={reset}
              />
            </FadeIn>

            <FadeIn delay={0.05}>
              <div className="mt-6 mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    Ajan Detayları
                  </h2>
                  <p className="mt-0.5 text-[12px] text-text-2">
                    Komitenin parça parça ürettiği notlar aşağıda güncellenir.
                  </p>
                </div>
                {sources.length > 0 && (
                  <div className="flex max-w-full flex-wrap justify-end gap-1.5">
                    {sources.slice(0, 5).map((s) => (
                      <SourceChip
                        key={s}
                        source={{ id: s, kind: "filing" }}
                      />
                    ))}
                    {sources.length > 5 && (
                      <span className="inline-flex items-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                        +{sources.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {visibleAgents.length === 0 ? (
                <QueuePanel queuedAgents={queuedAgents} />
              ) : (
                <>
                  <StaggerContainer
                    stagger={0.04}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  >
                    {visibleAgents.map((meta) => (
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
                  {state === "running" && queuedAgents.length > 0 && (
                    <QueueStrip queuedAgents={queuedAgents} />
                  )}
                </>
              )}
            </FadeIn>

            {state === "done" && (
              <FadeIn delay={0.1}>
                <DoneCard
                  symbol={symbol}
                  persona={persona}
                  confidence={confidence}
                  sourceCount={sources.length}
                  onViewer={openViewer}
                  onRestart={reset}
                />
              </FadeIn>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

// ─────────────────────────────────────────────────────────
// IDLE — Hero form
// ─────────────────────────────────────────────────────────

function IdleHero({
  title,
  subtitle,
  symbol,
  setSymbol,
  persona,
  setPersona,
  question,
  setQuestion,
  onStart,
}: {
  title: string;
  subtitle: string;
  symbol: string;
  setSymbol: (v: string) => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
  question: string;
  setQuestion: (q: string) => void;
  onStart: () => void;
}) {
  const selectedPersona = PERSONA_COPY[persona];

  return (
    <FadeIn>
      <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 items-center gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart();
          }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)] sm:p-6"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563EB,#22C55E,#F59E0B)]" />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                {subtitle}
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-text-2">
                BIST sembolüyle kaynaklı komite tezi, güven skoru ve ajan
                notları tek akışta üretilir.
              </p>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 text-[11.5px] font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Canlı
            </span>
          </div>

          <div className="mt-7">
            <label
              htmlFor="hero-symbol"
              className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Hisse sembolü
            </label>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="hero-symbol"
                  autoFocus
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ASELS"
                  className="h-[60px] w-full rounded-xl border border-border bg-slate-50 pl-11 pr-4 font-mono text-2xl font-extrabold uppercase tracking-wide text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 dark:bg-muted dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={!symbol.trim()}
                className="group inline-flex h-[60px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-[0_12px_28px_-12px_#3B82F6] transition-all hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Komiteyi Başlat
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-muted-foreground">
              Popüler
            </span>
            {POPULAR.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSymbol(p)}
                className={cn(
                  "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  symbol === p
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary text-text-2 hover:border-primary/40 hover:text-primary",
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Komite stratejisi
              </label>
              <div className="mt-2 grid grid-cols-2 rounded-xl border border-border bg-muted/25 p-1">
                <PersonaToggle
                  value="default"
                  active={persona === "default"}
                  onClick={() => setPersona("default")}
                />
                <PersonaToggle
                  value="conservative"
                  active={persona === "conservative"}
                  onClick={() => setPersona("conservative")}
                />
              </div>
              <p className="mt-2 min-h-[34px] text-[11.5px] leading-relaxed text-text-2">
                {selectedPersona.body}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Odak sorusu
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Opsiyonel
                </span>
              </div>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Örn: ${symbol || "ASELS"} için 4Ç katalist takvimi nasıl?`}
                className="mt-2 h-11 w-full rounded-lg border border-border bg-slate-50 px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 dark:bg-muted dark:text-white"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11.5px] text-muted-foreground">
            <span>Üretilen tezler bilgi amaçlıdır; yatırım tavsiyesi değildir.</span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <CircleDot className="h-3.5 w-3.5 text-bull" />
              {symbol || "----"} / {selectedPersona.compact}
            </span>
          </div>
        </form>

        <aside className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Seçili Komite
              </div>
              <div className="mt-1 font-mono text-3xl font-extrabold text-slate-900 dark:text-white">
                {symbol || "----"}
              </div>
            </div>
            <div
              className={cn(
                "grid h-12 w-12 place-items-center rounded-xl",
                persona === "conservative"
                  ? "bg-warn/10 text-warn"
                  : "bg-primary/10 text-primary",
              )}
            >
              {persona === "conservative" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-5">
            <PhaseRail phase="Hazırlanıyor" done={false} />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 border-y border-border py-4">
            <MiniStat icon={Activity} label="Ajan" value={String(AGENT_COUNT)} />
            <MiniStat icon={Gauge} label="Güven" value="0" suffix="%" />
            <MiniStat icon={BarChart3} label="Kaynak" value="0" />
          </div>

          <div className="mt-5 text-[12.5px] leading-relaxed text-text-2">
            <span className="font-semibold text-slate-900 dark:text-white">
              Odak alanı:
            </span>{" "}
            sembol, strateji ve isteğe bağlı soru. Başlatınca bu panel canlı
            ilerleme görünümüne dönüşür.
          </div>
        </aside>
      </div>
    </FadeIn>
  );
}

function PersonaToggle({
  value,
  active,
  onClick,
}: {
  value: Persona;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = value === "conservative" ? ShieldAlert : Sparkles;
  const tone =
    value === "conservative"
      ? "text-warn border-warn/25 bg-warn/10"
      : "text-primary border-primary/25 bg-primary/10";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border text-[12px] font-semibold transition-colors",
        active
          ? tone
          : "border-transparent text-muted-foreground hover:bg-card hover:text-text-2",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{PERSONA_COPY[value].compact}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// RUNNING — Compact header
// ─────────────────────────────────────────────────────────

function RunHeader({
  symbol,
  persona,
  phase,
  progress,
  running,
  done,
  finishedAgents,
  totalAgents,
  confidence,
  sourceCount,
  runningAgents,
  onRestart,
}: {
  symbol: string;
  persona: Persona;
  phase: PhaseId;
  progress: number;
  running: boolean;
  done: boolean;
  finishedAgents: number;
  totalAgents: number;
  confidence: number;
  sourceCount: number;
  runningAgents: string[];
  onRestart: () => void;
}) {
  const copy = PHASE_COPY[phase];
  const personaLabel = PERSONA_COPY[persona].compact;
  const personaTone =
    persona === "conservative" ? "text-warn" : "text-primary";
  const activeText =
    runningAgents.length > 0
      ? `${runningAgents.slice(0, 2).join(" · ")}${runningAgents.length > 2 ? "…" : ""}`
      : done
        ? "Komite tamamlandı"
        : running
          ? "Süreç başlatılıyor"
          : "Bekliyor";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.55)] sm:p-6">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          done
            ? "bg-bull"
            : "bg-[linear-gradient(90deg,#2563EB,#22C55E,#F59E0B)]",
        )}
      />

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {symbol}
            </span>
            <span
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[11.5px] font-semibold",
                personaTone,
                persona === "conservative"
                  ? "border-warn/30"
                  : "border-primary/30",
              )}
            >
              {persona === "conservative" ? (
                <ShieldAlert className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {personaLabel}
            </span>
            <span
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold",
                done
                  ? "border-bull/30 bg-bull/10 text-bull"
                  : "border-primary/25 bg-primary/10 text-primary",
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              {done ? "Tamamlandı" : "Canlı"}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-2">
            {copy.body}
          </p>
          <p className="mt-3 text-[12.5px] text-text-2">
            <span className="font-semibold text-slate-900 dark:text-white">
              Aktif:
            </span>{" "}
            {activeText}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 xl:w-[420px]">
          <MiniStat
            icon={Activity}
            label="Ajan"
            value={`${finishedAgents}/${totalAgents}`}
          />
          <MiniStat
            icon={Gauge}
            label="Güven"
            value={String(Math.round(confidence))}
            suffix="%"
          />
          <MiniStat icon={BarChart3} label="Kaynak" value={String(sourceCount)} />
        </div>
      </div>

      <div className="mt-6">
        <PhaseRail phase={phase} done={done} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              done
                ? "bg-bull"
                : "bg-[linear-gradient(90deg,#2563EB,#22C55E,#F59E0B)]",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
          {progress}%
        </span>
      </div>

      {done && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:text-slate-900 dark:hover:text-white"
            title="Yeni tez başlat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Yeni Tez
          </button>
        </div>
      )}
    </div>
  );
}

function PhaseRail({
  phase,
  done,
}: {
  phase: PhaseId;
  done: boolean;
}) {
  const currentIndex = PHASES.findIndex((item) => item.id === phase);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {PHASES.map((item, index) => {
        const complete = done || index < currentIndex;
        const active = !done && index === currentIndex;

        return (
          <div
            key={item.id}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors sm:flex-col sm:items-start",
              complete &&
                "border-bull/25 bg-bull/[0.06] text-slate-900 dark:text-white",
              active &&
                "border-primary/35 bg-primary/[0.08] text-slate-900 dark:text-white",
              !complete &&
                !active &&
                "border-border bg-muted/20 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                complete && "border-bull bg-bull text-white",
                active && "border-primary bg-primary text-primary-foreground",
                !complete && !active && "border-border bg-card",
              )}
            >
              {complete ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
            </span>
            <span className="truncate text-[11.5px] font-semibold">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
        {value}
        {suffix && (
          <span className="ml-0.5 text-[12px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function QueuePanel({ queuedAgents }: { queuedAgents: string[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white">
              Komite hazırlanıyor
            </h3>
            <p className="mt-1 text-[12.5px] text-text-2">
              İlk ajan başladığında not kartları burada görünür.
            </p>
          </div>
        </div>
        <div className="flex max-w-full flex-wrap justify-end gap-1.5">
          {queuedAgents.slice(0, 4).map((name) => (
            <span
              key={name}
              className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground"
            >
              {name}
            </span>
          ))}
          {queuedAgents.length > 4 && (
            <span className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
              +{queuedAgents.length - 4}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueStrip({ queuedAgents }: { queuedAgents: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2">
      <span className="mr-1 text-[11.5px] font-medium text-muted-foreground">
        Bekleyen
      </span>
      {queuedAgents.slice(0, 6).map((name) => (
        <span
          key={name}
          className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {name}
        </span>
      ))}
      {queuedAgents.length > 6 && (
        <span className="font-mono text-[11px] text-muted-foreground">
          +{queuedAgents.length - 6}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DONE — Synthesis result card
// ─────────────────────────────────────────────────────────

function DoneCard({
  symbol,
  persona,
  confidence,
  sourceCount,
  onViewer,
  onRestart,
}: {
  symbol: string;
  persona: Persona;
  confidence: number;
  sourceCount: number;
  onViewer: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-bull/30 bg-card p-6 shadow-[0_24px_60px_-44px_rgba(34,197,94,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bull/15 text-bull">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-bull">
              Tez Hazır
            </div>
            <h3 className="mt-0.5 text-[18px] font-bold text-slate-900 dark:text-white">
              {symbol} · Komite Sentezi Tamamlandı
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-text-2">
              {PERSONA_COPY[persona].compact} stratejiyle
              üretilen kaynaklı tez kaydedildi. Detaylı raporu, bull/bear
              argümanlarını ve katalistleri raporda inceleyebilirsin.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            icon={Gauge}
            label="Güven"
            value={String(Math.round(confidence))}
            suffix="%"
          />
          <MiniStat icon={BarChart3} label="Kaynak" value={String(sourceCount)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onViewer}
          className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground shadow-[0_10px_25px_-10px_#3B82F6] transition-all hover:bg-[#2563EB]"
        >
          Tezi Görüntüle
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[13px] font-medium text-text-2 transition-colors hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Başka Bir Hisse
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          Güven {Math.round(confidence)}/100
        </span>
      </div>
    </div>
  );
}
