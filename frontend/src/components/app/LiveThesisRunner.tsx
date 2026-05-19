"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
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
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  liveSessionActions,
  useLiveSession,
  type AgentState,
  type PhaseId,
  type Persona,
} from "@/lib/state/liveSession";
import { AgentCard, type AgentCardStatus } from "./AgentCard";
import { SourceChip } from "./SourceChip";
import { cn } from "@/lib/utils";
import {
  PageTransition,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/MotionWrappers";

// Per-agent ilerleme tavanı — `agent_done` gelene dek pct bu değeri geçmez.
// Eski kod 99'a kadar dolduruyordu → bar uzun süre 99'da donmuş görünüyordu.
// 88'e indirince done geldiğinde 88→100 sıçraması "tamamlandı" hissi veriyor.
// (Store içinde tekrar tanımlı — component-side smoothing creep için lazım.)
const AGENT_PCT_CEILING = 88;

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
  {
    label: string;
    compact: string;
    body: string;
    tagline: string;
    bullets: string[];
  }
> = {
  default: {
    label: "Dengeli Analiz",
    compact: "Dengeli",
    tagline: "Standart sentez · güven skoru sınırsız",
    body: "Bull ve bear argümanları aynı ağırlıkta değerlendirilir; sayısal tez profesyonel rapor formatında üretilir.",
    bullets: [
      "Standart synthesizer promptu",
      "Bull ↔ Bear eşit ağırlık",
      "Tüm sektör profilleri için uygun",
    ],
  },
  conservative: {
    label: "Muhafazakâr",
    compact: "Muhafazakâr",
    tagline: "Bear-first sentez · güven skoru ≤70 ile sınırlı",
    body: "Önce risk ve aşağı yönlü senaryolar yazılır; temettü güvenliği, volatilite ve sermaye koruma açıkça değerlendirilir.",
    bullets: [
      "Risk önce, getiri sonra",
      "Temettü & sermaye koruma vurgusu",
      "Final güven skoru 70 ile cap'lenir",
    ],
  },
};

const SEAT_POSITIONS: { left: string; top: string; rotation: string }[] = [
  { left: "50%", top: "18%", rotation: "0deg" },
  { left: "69%", top: "26%", rotation: "42deg" },
  { left: "76%", top: "50%", rotation: "90deg" },
  { left: "66%", top: "76%", rotation: "138deg" },
  { left: "34%", top: "76%", rotation: "222deg" },
  { left: "24%", top: "50%", rotation: "270deg" },
  { left: "31%", top: "26%", rotation: "318deg" },
];

const AGENT_TONE_RGB: Record<string, string> = {
  bull: "34 197 94",
  bear: "239 68 68",
  warn: "245 158 11",
  violet: "139 92 246",
  cyan: "34 211 238",
  primary: "37 99 235",
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const session = useLiveSession();
  const {
    symbol,
    persona,
    running,
    assembling,
    phase,
    confidence,
    sources,
    agents,
    done,
    error,
    thesisId,
    phaseProgress,
    startTick,
  } = session;

  const setSymbol = (s: string) => liveSessionActions.setSymbol(s);
  const setPersona = (p: Persona) => liveSessionActions.setPersona(p);

  const start = (overrideSymbol?: string) => {
    const sym = (overrideSymbol ?? symbol).trim().toUpperCase();
    if (!sym) return;
    // Auth guard — tez üretmek için login zorunlu (backend 401 dönerdi, kullanıcı
    // hata mesajı görürdü; daha iyisi pre-emptive redirect).
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/app/thesis/live")}`);
      return;
    }
    liveSessionActions.start({ symbol: sym, persona });
  };

  // Inline WS event handler'ları artık `liveSession` store'unun applyEvent
  // reducer'ında — bkz. `frontend/src/lib/state/liveSession.ts`. Component
  // unmount olsa bile WS açık kalır, sekme dönüşünde state korunur.

  // Sayfaya ilk girişte store boşsa, route'dan gelen defaults form'a yansısın.
  // Aktif bir session (running/done) varsa override yok — kullanıcı geri dönerken
  // mevcut tezini görmeye devam etsin.
  useEffect(() => {
    if (running || done) return;
    if (!symbol && defaultSymbol) {
      liveSessionActions.setSymbol(defaultSymbol);
    }
    if (persona !== defaultPersona) {
      liveSessionActions.setPersona(defaultPersona);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSymbol, defaultPersona]);

  // autoStart: URL'de ?symbol= ile gelindiyse otomatik başlat. Aktif bir
  // session zaten varsa (running/done) yeniden başlatma — kullanıcı sekme
  // değiştirip geri döndüğünde mevcut tezi görmeye devam etsin.
  useEffect(() => {
    if (!autoStart || !defaultSymbol) return;
    if (running || done) return;
    const t = setTimeout(() => start(defaultSymbol), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, defaultSymbol, startTick]);

  // Zaman tabanlı asimptotik creep — running ajanlar tool_progress event'i
  // gelmese bile CEILING'e doğru sürekli ilerlesin. Bu sayede:
  //  (a) `expected=1` ajanlar tek tool_progress'te 99'a sıçrayıp donmuyor,
  //  (b) backend ajan içinde uzun bir LLM çağrısı yaparken bar hareketli kalıyor,
  //  (c) agent_done geldiğinde pct ~70-85 civarındadır → 100 snap'i tatmin edici.
  // Her tick: pct = pct + (CEILING - pct) * 0.022 → ~12-15 saniyede 85'e yaklaşır.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      liveSessionActions.setAgents((p) => {
        let changed = false;
        const next: typeof p = { ...p };
        for (const a of AGENT_REGISTRY) {
          const cur = next[a.id];
          if (!cur || cur.status !== "running") continue;
          // Synthesizer token-based pct kullanıyor (token handler güncelliyor),
          // creep ile çift güncellemeyelim — token akışı kendi hızında ilerler.
          if (a.id === "synthesizer") continue;
          const curPct = cur.pct ?? 4;
          if (curPct >= AGENT_PCT_CEILING) continue;
          const step = Math.max(0.35, (AGENT_PCT_CEILING - curPct) * 0.022);
          const newPct = Math.min(AGENT_PCT_CEILING, curPct + step);
          next[a.id] = { ...cur, pct: newPct };
          changed = true;
        }
        return changed ? next : p;
      });
    }, 220);
    return () => clearInterval(id);
  }, [running]);

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

  // Hedef yüzde: her ajanın (creep + tool_progress kaynaklı) bireysel pct'sinin
  // ortalaması. status="done" → 100, status="running" → ajanın pct'si (yoksa 6),
  // status="idle" → 0. Done state ise sabit 100. Cap 95% — backend `done` gelene
  // dek %100 göstermiyoruz; ajan tavanı 88 olduğundan toplam ortalama da
  // doğal olarak bunun altında kalır (zaten 95 nadiren zorlanır).
  const targetProgress = useMemo(() => {
    if (done) return 100;
    let sum = 0;
    for (const a of AGENT_REGISTRY) {
      const st = agents[a.id];
      if (!st) continue;
      if (st.status === "done") sum += 100;
      else if (st.status === "running") {
        sum += Math.max(6, st.pct ?? 6);
      }
    }
    const avg = sum / AGENT_COUNT;
    return Math.min(95, Math.round(avg));
  }, [agents, done]);

  // Smoothing: hedef yüzdeye 0.4%/100ms hızında ilerle. Bu sayede 0→55 gibi
  // büyük sıçramalar kullanıcıya pürüzsüz bar olarak görünür. Done olduğunda
  // 100'e bir defalık snap.
  useEffect(() => {
    if (done) {
      const id = window.setTimeout(
        () => liveSessionActions.setPhaseProgress(100),
        0,
      );
      return () => window.clearTimeout(id);
    }
    const id = setInterval(() => {
      const cur = phaseProgress;
      if (cur >= targetProgress) return;
      const step = Math.max(0.4, (targetProgress - cur) * 0.08);
      liveSessionActions.setPhaseProgress(Math.min(targetProgress, cur + step));
    }, 120);
    return () => clearInterval(id);
  }, [targetProgress, done, phaseProgress]);

  const openViewer = () => {
    if (thesisId) router.push(`/app/thesis/${thesisId}`);
    else router.push("/app/history");
  };

  const reset = () => {
    liveSessionActions.reset();
  };

  const state: "idle" | "assembling" | "running" | "done" = done
    ? "done"
    : assembling
      ? "assembling"
      : running
        ? "running"
        : "idle";

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] px-4 py-5 sm:px-6 sm:py-7">
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
            onStart={() => start()}
          />
        )}

        {state === "assembling" && <AssemblyScene symbol={symbol} />}

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
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {visibleAgents
                      .filter((meta) => meta.id !== "synthesizer")
                      .map((meta) => (
                        <StaggerItem key={meta.id}>
                          <AgentCard
                            meta={meta}
                            status={agents[meta.id]?.status ?? "idle"}
                            text={agents[meta.id]?.text}
                            confidence={agents[meta.id]?.confidence}
                            pct={agents[meta.id]?.pct}
                          />
                        </StaggerItem>
                      ))}
                  </StaggerContainer>
                  {(() => {
                    const synth = visibleAgents.find(
                      (m) => m.id === "synthesizer",
                    );
                    if (!synth) return null;
                    return (
                      <FadeIn delay={0.05}>
                        <div className="mt-3">
                          <AgentCard
                            wide
                            meta={synth}
                            status={agents[synth.id]?.status ?? "idle"}
                            text={agents[synth.id]?.text}
                            confidence={agents[synth.id]?.confidence}
                            pct={agents[synth.id]?.pct}
                          />
                        </div>
                      </FadeIn>
                    );
                  })()}
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
  onStart,
}: {
  title: string;
  subtitle: string;
  symbol: string;
  setSymbol: (v: string) => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
  onStart: () => void;
}) {
  const selectedPersona = PERSONA_COPY[persona];

  return (
    <FadeIn>
      <div className="mx-auto flex min-h-[calc(100vh-170px)] w-full max-w-2xl items-center py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart();
          }}
          className="relative w-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)] sm:p-6"
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
                  data-tour="new-thesis-symbol"
                  autoFocus
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ASELS"
                  className="h-[60px] w-full rounded-xl border border-border bg-slate-50 pl-11 pr-4 font-mono text-2xl font-extrabold uppercase tracking-wide text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 dark:bg-muted dark:text-white"
                />
              </div>
              <button
                type="submit"
                data-tour="new-thesis-start"
                disabled={!symbol.trim()}
                className="group inline-flex h-[60px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-[0_12px_28px_-12px_#3B82F6] transition-all hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Komiteyi Topla
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

          <div className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Komite stratejisi
              </label>
              <span className="text-[11px] text-muted-foreground">
                Synthesizer promptu ve güven cap&apos;i etkilenir
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PersonaCard
                value="default"
                active={persona === "default"}
                onClick={() => setPersona("default")}
              />
              <PersonaCard
                value="conservative"
                active={persona === "conservative"}
                onClick={() => setPersona("conservative")}
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
      </div>
    </FadeIn>
  );
}

function PersonaCard({
  value,
  active,
  onClick,
}: {
  value: Persona;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = value === "conservative" ? ShieldAlert : Sparkles;
  const tone = value === "conservative" ? "warn" : "primary";
  const meta = PERSONA_COPY[value];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-4 text-left transition-all",
        "hover:border-primary/40 hover:bg-accent/20",
        active
          ? tone === "warn"
            ? "border-warn/50 bg-warn/[0.04] shadow-[0_18px_42px_-28px_rgba(245,158,11,0.55)] ring-1 ring-warn/30"
            : "border-primary/50 bg-primary/[0.04] shadow-[0_18px_42px_-28px_rgba(59,130,246,0.55)] ring-1 ring-primary/30"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg",
              tone === "warn"
                ? "bg-warn/10 text-warn"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
              {meta.label}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {meta.tagline}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            active
              ? tone === "warn"
                ? "border-warn bg-warn text-white"
                : "border-primary bg-primary text-white"
              : "border-border",
          )}
          aria-hidden
        >
          {active && (
            <span className="block h-1.5 w-1.5 rounded-full bg-white" />
          )}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-text-2">
        {meta.body}
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-[11.5px] text-muted-foreground">
        {meta.bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <span
              className={cn(
                "mt-1 inline-block h-1 w-1 shrink-0 rounded-full",
                tone === "warn" ? "bg-warn" : "bg-primary",
              )}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function AssemblyScene({ symbol }: { symbol: string }) {
  return (
    <FadeIn>
      <div
        className="committee-stage relative min-h-[calc(100vh-170px)] overflow-hidden rounded-2xl border border-border p-4 sm:p-6"
        aria-live="polite"
      >
        <div className="committee-blurred-ui pointer-events-none absolute inset-[-24px] scale-[1.04]">
          <div className="mx-auto mt-8 h-[84px] w-[72%] rounded-2xl border border-border bg-white/60" />
          <div className="mx-auto mt-7 grid w-[84%] grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[110px] rounded-xl border border-border bg-white/50"
              />
            ))}
          </div>
        </div>
        <div className="committee-veil absolute inset-0" />

        <div className="committee-scene relative z-20 flex min-h-[calc(100vh-220px)] items-center justify-center">
          <div className="relative mx-auto aspect-[16/9] w-full min-h-[560px] max-w-[1180px]">
            <div className="committee-table absolute left-1/2 top-[51%] h-[185px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] sm:h-[250px] sm:w-[470px]">
              <div className="absolute inset-4 rounded-[50%] border border-slate-400/45 bg-slate-100/35" />
              <div className="committee-symbol absolute left-1/2 top-1/2 rounded-[14px] border border-primary/40 bg-primary/10 px-5 py-2.5 font-mono text-[24px] font-black tracking-wide text-primary sm:px-6 sm:py-3 sm:text-[34px]">
                {symbol}
              </div>
            </div>

            {AGENT_REGISTRY.map((agent, index) => {
              const seat = SEAT_POSITIONS[index % SEAT_POSITIONS.length];
              const tone = AGENT_TONE_RGB[agent.tone] ?? AGENT_TONE_RGB.primary;
              return (
                <div
                  key={agent.id}
                  className="committee-agent absolute"
                  style={
                    {
                      left: seat.left,
                      top: seat.top,
                      "--rotation": seat.rotation,
                      "--delay": `${220 + index * 400}ms`,
                      "--tone": tone,
                    } as CSSProperties
                  }
                >
                  <div className="committee-agent-orient">
                    <div
                      aria-hidden="true"
                      className="committee-figure"
                      style={{
                        backgroundImage:
                          "url(/assets/committee/agent-silhouette.svg)",
                      }}
                    />
                    <div className="committee-agent-label">
                      {agent.name}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="committee-ready absolute bottom-8 left-1/2 inline-flex items-center gap-2">
              <span className="committee-ready-dot" />
              Komite toplandı
            </div>
          </div>
        </div>

        <style>{`
          .committee-stage {
            background:
              radial-gradient(circle at 50% 44%, rgba(248, 250, 252, 0.72), transparent 38%),
              linear-gradient(180deg, #d6dde7 0%, #c4ccd8 100%);
            box-shadow: 0 42px 100px -54px rgba(15, 23, 42, 0.72);
          }

          .committee-stage::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(circle at 50% 50%, transparent 0%, transparent 48%, rgba(15, 23, 42, 0.20) 100%),
              linear-gradient(115deg, rgba(255, 255, 255, 0.18), transparent 42%, rgba(15, 23, 42, 0.08));
            z-index: 1;
          }

          .committee-blurred-ui {
            opacity: 0.34;
            filter: blur(10px);
          }

          .committee-veil {
            background: rgba(203, 213, 225, 0.62);
            backdrop-filter: blur(9px) saturate(0.82);
          }

          .committee-table {
            border: 1px solid rgba(148, 163, 184, 0.72);
            background:
              radial-gradient(ellipse at 50% 42%, rgba(226, 232, 240, 0.98) 0%, rgba(203, 213, 225, 0.98) 48%, rgba(148, 163, 184, 0.98) 100%);
            box-shadow:
              0 34px 58px -32px rgba(15, 23, 42, 0.72),
              inset 0 0 0 22px rgba(241, 245, 249, 0.48),
              inset 0 0 0 23px rgba(100, 116, 139, 0.42);
          }

          .committee-table::before {
            content: "";
            position: absolute;
            inset: -22px;
            border: 1px solid rgba(37, 99, 235, 0.16);
            border-radius: 50%;
            animation: tf-committee-ring 1200ms ease-in-out infinite;
          }

          .committee-agent {
            width: 136px;
            height: 132px;
            opacity: 0;
            transform: translate(-50%, 34%) scale(0.7);
            filter: blur(8px);
            animation: tf-committee-seat 680ms cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
            animation-delay: var(--delay);
            z-index: 3;
          }

          .committee-agent-orient {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transform: rotate(var(--rotation));
            transform-origin: center center;
          }

          .committee-figure {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            filter: drop-shadow(0 18px 14px rgb(var(--tone) / 0.2));
          }

          .committee-agent-label {
            width: max-content;
            max-width: 120px;
            margin: -4px auto 0;
            border: 1.5px solid rgb(var(--tone) / 0.62);
            border-radius: 999px;
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 250, 252, 0.72)),
              rgb(var(--tone) / 0.18);
            color: rgb(var(--tone));
            padding: 6px 10px;
            font-size: 11px;
            line-height: 1;
            font-weight: 900;
            white-space: nowrap;
            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
            box-shadow:
              0 16px 34px -24px rgb(var(--tone) / 0.88),
              0 2px 8px rgba(15, 23, 42, 0.16);
          }

          .committee-ready {
            opacity: 0;
            transform: translate(-50%, 8px);
            border: 1.5px solid rgb(34 197 94 / 0.62);
            border-radius: 16px;
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(240, 253, 244, 0.76)),
              rgb(34 197 94 / 0.18);
            color: rgb(34 197 94);
            padding: 13px 18px;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.01em;
            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);
            z-index: 4;
            box-shadow:
              0 20px 44px -24px rgb(34 197 94 / 0.9),
              0 2px 10px rgba(15, 23, 42, 0.18),
              0 0 28px rgb(34 197 94 / 0.16);
            animation: tf-committee-ready 500ms ease-out 3580ms forwards;
          }

          .committee-ready-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgb(34 197 94);
            box-shadow: 0 0 16px rgb(34 197 94 / 0.7);
          }

          .committee-symbol {
            opacity: 0;
            box-shadow: 0 0 24px rgb(37 99 235 / 0.22);
            animation:
              tf-committee-symbol-enter 520ms cubic-bezier(0.2, 0.85, 0.2, 1) 3060ms forwards,
              tf-committee-symbol 1150ms ease-in-out 3580ms infinite;
          }

          @keyframes tf-committee-seat {
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
              filter: blur(0);
            }
          }

          @keyframes tf-committee-ready {
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }

          @keyframes tf-committee-ring {
            0%, 100% {
              opacity: 0.45;
              transform: scale(1);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.03);
            }
          }

          @keyframes tf-committee-symbol-enter {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.76);
              filter: blur(8px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
              filter: blur(0);
            }
          }

          @keyframes tf-committee-symbol {
            0%, 100% {
              box-shadow: 0 0 24px rgb(37 99 235 / 0.22);
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              box-shadow: 0 0 48px rgb(37 99 235 / 0.42);
              transform: translate(-50%, -50%) scale(1.06);
            }
          }

          @media (min-width: 640px) {
            .committee-agent {
              width: 166px;
              height: 162px;
            }

            .committee-figure {
              width: 98px;
              height: 98px;
            }

            .committee-agent-label {
              max-width: 154px;
              padding: 8px 13px;
              font-size: 13px;
            }
          }
        `}</style>
      </div>
    </FadeIn>
  );
}

// ─────────────────────────────────────────────────────────
// LoadingDots — sliding 3-dot conveyor (SVG SMIL animation)
// ─────────────────────────────────────────────────────────

function LoadingDots({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-3 -3 30 30"
      width="22"
      height="22"
      aria-hidden
      className={cn("text-primary", className)}
    >
      <circle cx="4" cy="12" r="0" fill="currentColor">
        <animate
          fill="freeze"
          attributeName="r"
          begin="0;SVGUppsBdVN.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="0;3"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVGqCgsydxJ.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="4;12"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVG3PwDNd6F.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="12;20"
        />
        <animate
          id="SVG3V8yEdYE"
          fill="freeze"
          attributeName="r"
          begin="SVG6wCQhd9Q.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="3;0"
        />
        <animate
          id="SVGUppsBdVN"
          fill="freeze"
          attributeName="cx"
          begin="SVG3V8yEdYE.end"
          dur="0.001s"
          values="20;4"
        />
      </circle>
      <circle cx="4" cy="12" r="3" fill="currentColor">
        <animate
          fill="freeze"
          attributeName="cx"
          begin="0;SVGUppsBdVN.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="4;12"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVGqCgsydxJ.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="12;20"
        />
        <animate
          id="SVG4PgJdbds"
          fill="freeze"
          attributeName="r"
          begin="SVG3PwDNd6F.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="3;0"
        />
        <animate
          id="SVG6wCQhd9Q"
          fill="freeze"
          attributeName="cx"
          begin="SVG4PgJdbds.end"
          dur="0.001s"
          values="20;4"
        />
        <animate
          fill="freeze"
          attributeName="r"
          begin="SVG6wCQhd9Q.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="0;3"
        />
      </circle>
      <circle cx="12" cy="12" r="3" fill="currentColor">
        <animate
          fill="freeze"
          attributeName="cx"
          begin="0;SVGUppsBdVN.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="12;20"
        />
        <animate
          id="SVG38aCdcdI"
          fill="freeze"
          attributeName="r"
          begin="SVGqCgsydxJ.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="3;0"
        />
        <animate
          id="SVG3PwDNd6F"
          fill="freeze"
          attributeName="cx"
          begin="SVG38aCdcdI.end"
          dur="0.001s"
          values="20;4"
        />
        <animate
          fill="freeze"
          attributeName="r"
          begin="SVG3PwDNd6F.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="0;3"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVG6wCQhd9Q.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="4;12"
        />
      </circle>
      <circle cx="20" cy="12" r="3" fill="currentColor">
        <animate
          id="SVGwaWzveSq"
          fill="freeze"
          attributeName="r"
          begin="0;SVGUppsBdVN.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="3;0"
        />
        <animate
          id="SVGqCgsydxJ"
          fill="freeze"
          attributeName="cx"
          begin="SVGwaWzveSq.end"
          dur="0.001s"
          values="20;4"
        />
        <animate
          fill="freeze"
          attributeName="r"
          begin="SVGqCgsydxJ.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="0;3"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVG3PwDNd6F.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="4;12"
        />
        <animate
          fill="freeze"
          attributeName="cx"
          begin="SVG6wCQhd9Q.end"
          calcMode="spline"
          dur="0.5s"
          keySplines=".36,.6,.31,1"
          values="12;20"
        />
      </circle>
    </svg>
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

          <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            <span>{copy.title}</span>
            {running && !done && <LoadingDots />}
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
          {Math.round(progress)}%
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
