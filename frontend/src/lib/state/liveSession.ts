"use client";

/**
 * Live Thesis Session — module-level singleton store.
 *
 * Sorun: LiveThesisRunner tüm state'i component-local useState'lerde tutuyordu.
 * Kullanıcı `/app/thesis/live` sekmesinden çıkınca component unmount oluyor,
 * useEffect cleanup'ı WS'yi kapatıyor ve state siliniyor. Backend pipeline
 * arkaplanda devam etse bile UI re-mount'ta sıfır state ile başlıyordu.
 *
 * Çözüm: state + WS handle + event handler'ları component yaşam döngüsünden
 * bağımsız bu store'da tutulur. `useLiveSession()` hook'u state'i tüketir.
 * Component remount → store'dan canlı state okunur, WS açık kalır.
 *
 * `reset()` çağrılana veya `done`/`error` gelene kadar handle açık kalır.
 */

import { useSyncExternalStore } from "react";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { streamThesis, type StreamHandle } from "@/lib/api/thesis";
import type { StreamEvent } from "@/lib/mock/types";

export type AgentCardStatus = "idle" | "running" | "done";

export type AgentState = {
  status: AgentCardStatus;
  text: string;
  confidence?: number;
  pct?: number;
};

export type PhaseId =
  | "Hazırlanıyor"
  | "Veri Toplanıyor"
  | "Ajanlar Değerlendiriyor"
  | "Sentezleniyor"
  | "Tez Hazır";

export type Persona = "default" | "conservative";

const AGENT_EXPECTED_TOOLS: Record<string, number> = {
  "sector-router": 2,
  macro: 3,
  memory: 2,
  technical: 5,
  fundamental: 6,
  "devils-advocate": 3,
  synthesizer: 1,
};

const AGENT_PCT_CEILING = 88;
const ASSEMBLY_DURATION_MS = 4500;

function normalizePhase(phase?: string): PhaseId {
  if (phase === "Yönlendirme") return "Veri Toplanıyor";
  if (phase === "Müzakere") return "Ajanlar Değerlendiriyor";
  if (phase === "Sentez") return "Sentezleniyor";
  if (phase === "Hazır") return "Tez Hazır";
  if (
    phase === "Hazırlanıyor" ||
    phase === "Veri Toplanıyor" ||
    phase === "Ajanlar Değerlendiriyor" ||
    phase === "Sentezleniyor" ||
    phase === "Tez Hazır"
  ) {
    return phase;
  }
  return "Hazırlanıyor";
}

function initAgents(): Record<string, AgentState> {
  return Object.fromEntries(
    AGENT_REGISTRY.map((a) => [a.id, { status: "idle", text: "" }]),
  );
}

export type LiveSessionState = {
  symbol: string;
  persona: Persona;
  running: boolean;
  assembling: boolean;
  phase: PhaseId;
  confidence: number;
  sources: string[];
  agents: Record<string, AgentState>;
  done: boolean;
  error: string | null;
  thesisId: string | null;
  /** Form/UI smoothing — istemcide animasyonla yumuşatılır ama global tutuyoruz ki sekme dönüşünde geri tepme olmasın. */
  phaseProgress: number;
  /** `start()` yeni bir tez başlattığında artar — component bunu izleyip
   *  kendi smoothing timer'larını sıfırlayabilir. */
  startTick: number;
};

function initialState(): LiveSessionState {
  return {
    symbol: "",
    persona: "default",
    running: false,
    assembling: false,
    phase: "Hazırlanıyor",
    confidence: 0,
    sources: [],
    agents: initAgents(),
    done: false,
    error: null,
    thesisId: null,
    phaseProgress: 0,
    startTick: 0,
  };
}

let state: LiveSessionState = initialState();
let handle: StreamHandle | null = null;
let assemblyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function setState(updater: (s: LiveSessionState) => LiveSessionState) {
  state = updater(state);
  notify();
}

function clearAssemblyTimer() {
  if (assemblyTimer) {
    clearTimeout(assemblyTimer);
    assemblyTimer = null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export function getLiveSessionSnapshot(): LiveSessionState {
  return state;
}

export function subscribeLiveSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLiveSession(): LiveSessionState {
  // SSR snapshot olarak da client snapshot'ı kullan — module-level `state`
  // stable bir referans, server'da modül load anında `initialState()` ile
  // initialize ediliyor. `initialState`'i doğrudan vermek her çağrıda yeni
  // obje ürettiği için React "infinite loop" uyarısı atar (her seferinde
  // referans değişir → re-render).
  return useSyncExternalStore(
    subscribeLiveSession,
    getLiveSessionSnapshot,
    getLiveSessionSnapshot,
  );
}

export const liveSessionActions = {
  setSymbol(symbol: string) {
    setState((s) => ({ ...s, symbol }));
  },
  setPersona(persona: Persona) {
    setState((s) => ({ ...s, persona }));
  },
  setPhaseProgress(value: number) {
    setState((s) => ({ ...s, phaseProgress: value }));
  },
  /** Component-side smoothing (creep) için agents map'ini güncelle. */
  setAgents(updater: (a: Record<string, AgentState>) => Record<string, AgentState>) {
    setState((s) => ({ ...s, agents: updater(s.agents) }));
  },

  reset() {
    clearAssemblyTimer();
    handle?.stop();
    handle = null;
    state = initialState();
    notify();
  },

  /**
   * Yeni tez başlat. Mevcut session varsa kapatılır ve sıfırdan başlanır.
   * `done`/`error` gelene kadar WS açık kalır; component unmount olsa bile.
   */
  start(params: { symbol: string; persona: Persona }) {
    const sym = params.symbol.trim().toUpperCase();
    if (!sym) return;

    clearAssemblyTimer();
    handle?.stop();
    handle = null;

    state = {
      ...initialState(),
      symbol: sym,
      persona: params.persona,
      running: true,
      assembling: true,
      startTick: state.startTick + 1,
    };
    notify();

    assemblyTimer = setTimeout(() => {
      setState((s) => ({ ...s, assembling: false }));
      assemblyTimer = null;
    }, ASSEMBLY_DURATION_MS);

    handle = streamThesis(
      { symbol: sym, persona: params.persona },
      {
        onMeta: ({ thesisId }) => {
          setState((s) => ({ ...s, thesisId }));
        },
        onError: (msg) => {
          clearAssemblyTimer();
          setState((s) => ({
            ...s,
            assembling: false,
            error: msg,
            running: false,
          }));
        },
        onEvent: (e: StreamEvent) => applyEvent(e),
      },
    );
  },
};

// ─── Event reducer (orchestrator WS → state) ────────────────────────

function applyEvent(e: StreamEvent) {
  if (e.type === "phase" && e.phase) {
    setState((s) => ({ ...s, phase: normalizePhase(e.phase) }));
  }
  if (e.type === "agent_start" && e.agentId) {
    const id = e.agentId;
    setState((s) => {
      const cur = s.agents[id];
      if (!cur) return s;
      return {
        ...s,
        phase: id === "synthesizer" ? "Sentezleniyor" : "Ajanlar Değerlendiriyor",
        agents: {
          ...s.agents,
          [id]: { ...cur, status: "running", pct: cur.pct },
        },
      };
    });
  }
  if (e.type === "token" && e.agentId) {
    const id = e.agentId;
    setState((s) => {
      const cur = s.agents[id];
      if (!cur) return s;
      const nextText = (cur.text ?? "") + (e.payload as string);
      const synthPct =
        id === "synthesizer"
          ? Math.min(AGENT_PCT_CEILING, 5 + Math.floor(nextText.length / 65))
          : cur.pct;
      return {
        ...s,
        agents: {
          ...s.agents,
          [id]: {
            status: "running",
            text: nextText,
            confidence: cur.confidence,
            pct: synthPct,
          },
        },
      };
    });
  }
  if (e.type === "source" && typeof e.payload === "string") {
    const src = e.payload;
    setState((s) => ({
      ...s,
      phase: s.phase === "Hazırlanıyor" ? "Veri Toplanıyor" : s.phase,
      sources: s.sources.includes(src) ? s.sources : [...s.sources, src],
    }));
  }
  if (e.type === "confidence" && typeof e.payload === "number") {
    const conf = e.payload;
    setState((s) => {
      const nextAgents: Record<string, AgentState> = { ...s.agents };
      for (const id of Object.keys(nextAgents)) {
        const a = nextAgents[id];
        if (a.status === "running" && a.confidence === undefined) {
          nextAgents[id] = { ...a, confidence: conf };
        }
      }
      return { ...s, confidence: conf, agents: nextAgents };
    });
  }
  if (e.type === "agent_done" && e.agentId) {
    const id = e.agentId;
    setState((s) => {
      const cur = s.agents[id];
      if (!cur) return s;
      return {
        ...s,
        agents: {
          ...s.agents,
          [id]: { ...cur, status: "done", pct: 100 },
        },
      };
    });
  }
  if (e.type === "tool_progress" && e.agentId) {
    const id = e.agentId;
    setState((s) => {
      const cur = s.agents[id];
      if (!cur) return s;
      const expected = AGENT_EXPECTED_TOOLS[id] ?? 4;
      const stepFrac = 1 / Math.max(2, expected);
      const curPct = cur.pct ?? 0;
      const proposed = curPct + (AGENT_PCT_CEILING - curPct) * stepFrac;
      const newPct = Math.min(AGENT_PCT_CEILING, Math.max(curPct, proposed));
      return {
        ...s,
        agents: {
          ...s.agents,
          [id]: { ...cur, status: "running", pct: newPct },
        },
      };
    });
  }
  if (e.type === "done") {
    clearAssemblyTimer();
    setState((s) => ({
      ...s,
      assembling: false,
      phase: "Tez Hazır",
      done: true,
      running: false,
      thesisId: typeof e.payload === "string" ? e.payload : s.thesisId,
      agents: Object.fromEntries(
        AGENT_REGISTRY.map((a) => [
          a.id,
          { ...s.agents[a.id], status: "done", text: s.agents[a.id]?.text ?? "" },
        ]),
      ),
    }));
  }
}
