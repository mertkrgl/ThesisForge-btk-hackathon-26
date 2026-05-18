import type { StreamEvent } from "@/lib/mock/types";
import type { BackendWsEvent } from "@/lib/types/backend";

/**
 * Backend WS event'lerini frontend StreamEvent'lerine çevirir.
 *
 * Backend `stage` ↔ frontend `phase`. Backend her `stage` event'inde önceki
 * agent'ları done, sonrakileri running'e geçirmek için bu adapter context
 * tutuyor (lifecycle simülasyonu). Her backend event 0+ frontend event üretebilir.
 */

export type StreamAdapter = {
  /** Backend event geldiğinde çağrılır. */
  push: (be: BackendWsEvent) => StreamEvent[];
  /** Hata için ayrı callback; LiveThesisRunner bunu bir error state'ine bağlar. */
  consumeError: () => string | null;
  /** Backend 'done' event'inden gelen thesis_id (varsa). */
  doneThesisId: () => string | null;
};

const PHASE_PREP = "Hazırlanıyor";
const PHASE_DATA = "Veri Toplanıyor";
const PHASE_AGENTS = "Ajanlar Değerlendiriyor";
const PHASE_SYNTH = "Sentezleniyor";
const PHASE_DONE = "Tez Hazır";

// Backend DAG (orchestrator.py:204-292):
//   agents_dispatched → sector + macro + memory + technical paralel başlar
//   workers_started   → sadece sector bitti, fundamental devreye girer
//   devils_advocate   → technical + fundamental + memory burada gather edilir
//   synthesizer       → macro burada beklenir + devil's advocate biter
const PARALLEL_AT_DISPATCH = [
  "sector-router",
  "macro",
  "memory",
  "technical",
];
const DONE_AT_DEVIL = ["technical", "fundamental", "memory"];

// Backend agent_id → frontend agentId (StreamAdapter dışında AGENT_REGISTRY id'leri).
const _AGENT_ID_MAP: Record<string, string> = {
  sector_router: "sector-router",
  macro_context: "macro",
  memory_agent: "memory",
  technical_worker: "technical",
  fundamental_worker: "fundamental",
  devils_advocate: "devils-advocate",
  synthesizer: "synthesizer",
};

function _mapAgentId(backendId: string | undefined): string | undefined {
  if (!backendId) return undefined;
  return _AGENT_ID_MAP[backendId] ?? backendId;
}

const _KAYNAK_TOKEN_RE = /\[\s*kaynak\s*:\s*([a-f0-9-]{36})\s*\]/gi;

export function createStreamAdapter(): StreamAdapter {
  const startedAt = Date.now();
  const ofs = () => Date.now() - startedAt;
  let lastError: string | null = null;
  let doneId: string | null = null;
  let confidenceEmitted = false;
  // Token akışından çıkarılan unique [kaynak:UUID] set'i — frontend "Kaynak"
  // mini-stat'ı backend sources_count event'ini beklemeden canlı güncellesin.
  const tokenSourceIds = new Set<string>();

  return {
    push(be: BackendWsEvent): StreamEvent[] {
      const out: StreamEvent[] = [];

      switch (be.type) {
        case "agent_start":
          // Orchestrator başlangıç sinyali
          out.push({ offset: ofs(), type: "phase", phase: PHASE_PREP });
          break;

        case "stage":
          if (be.stage === "agents_dispatched") {
            // 4 ajan paralel başlar (DAG'a göre)
            out.push({ offset: ofs(), type: "phase", phase: PHASE_DATA });
            for (const a of PARALLEL_AT_DISPATCH) {
              out.push({ offset: ofs(), type: "agent_start", agentId: a });
            }
          } else if (be.stage === "workers_started") {
            // Sadece sector_router bitti (YAML lookup ~ms); fundamental devreye
            // giriyor. macro, memory, technical hala paralel çalışıyor.
            out.push({ offset: ofs(), type: "phase", phase: PHASE_AGENTS });
            out.push({
              offset: ofs(),
              type: "agent_done",
              agentId: "sector-router",
            });
            out.push({
              offset: ofs(),
              type: "agent_start",
              agentId: "fundamental",
            });
          } else if (be.stage === "devils_advocate") {
            // tech + fund + memory burada asyncio.gather ile toplanır → done.
            for (const a of DONE_AT_DEVIL) {
              out.push({ offset: ofs(), type: "agent_done", agentId: a });
            }
            out.push({
              offset: ofs(),
              type: "agent_start",
              agentId: "devils-advocate",
            });
          } else if (be.stage === "synthesizer") {
            // macro burada await edilir + devil's advocate biter.
            out.push({ offset: ofs(), type: "phase", phase: PHASE_SYNTH });
            out.push({ offset: ofs(), type: "agent_done", agentId: "macro" });
            out.push({
              offset: ofs(),
              type: "agent_done",
              agentId: "devils-advocate",
            });
            out.push({
              offset: ofs(),
              type: "agent_start",
              agentId: "synthesizer",
            });
          }
          // validator stage'i sessiz geçiyoruz (UI'da ayrı faz değil)
          break;

        case "token":
          out.push({
            offset: ofs(),
            type: "token",
            agentId: "synthesizer",
            payload: be.content,
          });
          // Token içinde [kaynak: UUID] varsa canlı kaynak sayımı için emit et.
          // Synthesizer markdown'ı stream ederken her UUID bir kez source
          // event'i olarak görünür → header'daki Kaynak mini-stat gerçek zamanlı
          // doluyor; pipeline bitmeden 0 görünmüyor.
          {
            const text = be.content;
            for (const m of text.matchAll(_KAYNAK_TOKEN_RE)) {
              const uuid = m[1].toLowerCase();
              if (tokenSourceIds.has(uuid)) continue;
              tokenSourceIds.add(uuid);
              out.push({ offset: ofs(), type: "source", payload: uuid });
            }
          }
          break;

        case "tool_progress":
          // Backend her tool çağrısı sonrası yayınlıyor; AgentCard içinde
          // per-agent ilerleme gösterimi için iletilir.
          out.push({
            offset: ofs(),
            type: "tool_progress",
            agentId: _mapAgentId(be.agent),
            tool: be.tool,
            status: be.status,
          });
          break;

        case "sources_count":
          // Final senaryoda backend kesin sayıyı söyler — duplicate önlemek için
          // tokenSourceIds zaten dolduysa ek source emit etmiyoruz. Daha düşük
          // sayı geldiyse de göstereceğimiz `payload` yine source event'leridir;
          // toplam kontrol burada UI tarafında değil backend tarafında doğru.
          break;

        case "critique":
          // Detayı UI'da ayrıca göstermiyoruz; agent_done devils-advocate'te emit'lendi
          break;

        case "done":
          if (typeof be.confidence === "number" && !confidenceEmitted) {
            out.push({
              offset: ofs(),
              type: "confidence",
              payload: be.confidence,
            });
            confidenceEmitted = true;
          }
          out.push({ offset: ofs(), type: "phase", phase: PHASE_DONE });
          out.push({
            offset: ofs(),
            type: "agent_done",
            agentId: "synthesizer",
          });
          out.push({ offset: ofs(), type: "done", payload: be.thesis_id });
          doneId = be.thesis_id;
          break;

        case "error":
          lastError = be.msg || "Bilinmeyen pipeline hatası";
          break;

        case "info":
          // Bilgi mesajı — UI tarafında console log yeterli
          break;
      }

      return out;
    },
    consumeError() {
      const e = lastError;
      lastError = null;
      return e;
    },
    doneThesisId() {
      return doneId;
    },
  };
}
