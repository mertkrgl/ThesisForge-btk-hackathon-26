import type {
  BackendBullBearPoint,
  BackendCatalyst,
  BackendCitation,
  BackendThesis,
  BackendThesisSummary,
} from "@/lib/types/backend";
import type {
  AgentTone,
  Source,
  Thesis,
  ThesisPoint,
  Verdict,
} from "@/lib/mock/types";
import { companyName } from "@/lib/data/companyNames";
import { squadLabel } from "@/lib/data/squadLabels";
import { toolToSource } from "@/lib/data/toolLabels";

/**
 * Backend thesis_md'sinden TL;DR bölümünü çıkar.
 * Pipeline her zaman "## TL;DR" başlığıyla başlıyor (synthesizer prompt).
 * `[kaynak: UUID]` etiketleri sıyrılır — bir-cümlelik özette gürültü.
 */
const _KAYNAK_TAG_RE = /\s*\[\s*kaynak\s*:\s*[a-f0-9-]{36}\s*\]/gi;

function _stripCitationTags(text: string): string {
  return text
    .replace(_KAYNAK_TAG_RE, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTldr(md: string | null | undefined): string {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^#{1,3}\s*TL[;:]?\s*DR/i.test(l));
  if (startIdx < 0) {
    const first = lines.find((l) => l.trim().length > 0);
    return _stripCitationTags(first ?? "");
  }
  const after = lines.slice(startIdx + 1);
  const body: string[] = [];
  for (const l of after) {
    if (/^#{1,3}\s+/.test(l)) break;
    body.push(l);
  }
  return _stripCitationTags(body.join(" "));
}

function deriveVerdict(
  bullCount: number,
  bearCount: number,
  confidence: number | null,
): Verdict {
  const conf = confidence ?? 50;
  if (bullCount > bearCount && conf >= 60) return "bull";
  if (bearCount > bullCount && conf <= 40) return "bear";
  return "neutral";
}

function clampScore(s: number | null | undefined, fallback = 0): number {
  if (s == null || Number.isNaN(s)) return fallback;
  if (s < 0) return 0;
  if (s > 100) return 100;
  return Math.round(s);
}

function bullBearToPoint(p: BackendBullBearPoint): ThesisPoint {
  return {
    text: p.point,
    sources: p.call_id ? [p.call_id] : [],
  };
}

function catalystToPoint(c: BackendCatalyst): ThesisPoint {
  const prefix = c.date ? `${c.date}: ` : "";
  const tag =
    c.impact === "high"
      ? " (yüksek etki)"
      : c.impact === "low"
        ? " (düşük etki)"
        : "";
  return {
    text: `${prefix}${c.event}${tag}`,
    sources: c.call_id ? [c.call_id] : [],
  };
}

/** Backend thesis → frontend Thesis (full DTO için). */
export function adaptThesis(
  bt: BackendThesis,
  opts?: { citations?: BackendCitation[] },
): Thesis {
  const bull = (bt.bull_points ?? []).map(bullBearToPoint);
  const bear = (bt.bear_points ?? []).map(bullBearToPoint);
  const catalysts = (bt.catalysts ?? []).map(catalystToPoint);

  const confidence = clampScore(bt.confidence, 0);
  const verdict = deriveVerdict(bull.length, bear.length, bt.confidence);
  const cb = bt.confidence_breakdown;

  // Backend pipeline'ındaki 7 agent — confidence_breakdown bileşenlerinden türetilir.
  const memoryHits = bt.memory_hits ?? [];
  const memorySummary =
    memoryHits.length > 0
      ? `${memoryHits.length} benzer geçmiş tez bulundu (en yakın: ${memoryHits[0]?.ticker ?? "—"}).`
      : "Geçmiş benzer tez bulunamadı.";

  const agents: Thesis["agents"] = [
    {
      id: "sector-router",
      summary: `Squad: ${squadLabel(bt.squad)}.`,
      confidence: 100,
    },
    {
      id: "macro",
      summary: cb
        ? `Makro bağlam skoru ${clampScore(cb.news_macro)}.`
        : "Makro bağlam değerlendirildi.",
      confidence: clampScore(cb?.news_macro, 50),
    },
    {
      id: "memory",
      summary: memorySummary,
      confidence: clampScore(cb?.memory_base, 50),
    },
    {
      id: "technical",
      summary: cb
        ? `Teknik analiz skoru ${clampScore(cb.technical)}.`
        : "Teknik analiz değerlendirildi.",
      confidence: clampScore(cb?.technical, 50),
    },
    {
      id: "fundamental",
      summary: cb
        ? `Temel analiz skoru ${clampScore(cb.fundamental)}.`
        : "Temel analiz değerlendirildi.",
      confidence: clampScore(cb?.fundamental, 50),
    },
    {
      id: "devils-advocate",
      summary: cb
        ? `Karşıt argüman gücü ${clampScore(100 - cb.devil_inverse)}.`
        : "Karşıt argümanlar değerlendirildi.",
      confidence: clampScore(cb?.devil_inverse, 50),
    },
    {
      id: "synthesizer",
      summary: `Sentez tamamlandı. Güven skoru ${confidence}.`,
      confidence,
    },
  ];

  // Sources — citations endpoint varsa onu kullan; yoksa call_id setinden minimal liste üret
  let sources: Source[] = [];
  if (opts?.citations && opts.citations.length > 0) {
    const seen = new Set<string>();
    for (const c of opts.citations) {
      if (c.is_kaynaksiz || !c.call_id) continue;
      if (seen.has(c.call_id)) continue;
      seen.add(c.call_id);
      sources.push(toolToSource(c.call_id, c.tool_name));
    }
  } else {
    const ids = new Set<string>();
    for (const p of bull) p.sources.forEach((s) => ids.add(s));
    for (const p of bear) p.sources.forEach((s) => ids.add(s));
    for (const p of catalysts) p.sources.forEach((s) => ids.add(s));
    sources = Array.from(ids).map((id) => toolToSource(id, null));
  }

  // KPIs — confidence_breakdown bileşenlerinden
  type Kpi = Thesis["kpis"][number];
  const kpis: Kpi[] = [];
  if (cb) {
    const toneOf = (n: number): AgentTone =>
      n >= 65 ? "bull" : n <= 35 ? "bear" : "warn";
    kpis.push(
      {
        label: "Veri Kalitesi",
        value: `${clampScore(cb.data_quality)}/100`,
        tone: toneOf(cb.data_quality),
      },
      {
        label: "Teknik",
        value: `${clampScore(cb.technical)}/100`,
        tone: toneOf(cb.technical),
      },
      {
        label: "Temel",
        value: `${clampScore(cb.fundamental)}/100`,
        tone: toneOf(cb.fundamental),
      },
      {
        label: "Şüpheci",
        value: `${clampScore(cb.devil_inverse)}/100`,
        tone: toneOf(cb.devil_inverse),
      },
    );
  }
  if (kpis.length === 0) {
    kpis.push({
      label: "Güven",
      value: `${confidence}/100`,
      tone: verdict === "bull" ? "bull" : verdict === "bear" ? "bear" : "warn",
    });
  }

  return {
    id: bt.id,
    ticker: bt.ticker,
    company: companyName(bt.ticker),
    sector: squadLabel(bt.squad),
    createdAt: bt.thesis_date ?? new Date().toISOString(),
    verdict,
    confidence,
    oneLiner:
      extractTldr(bt.thesis_md) ||
      bull[0]?.text ||
      `${bt.ticker} için ${squadLabel(bt.squad)} sektör analizi.`,
    bull,
    bear,
    catalysts,
    agents,
    sources,
    kpis,
    thesisMd: bt.thesis_md ?? undefined,
    citationLookup: opts?.citations
      ? opts.citations
          .filter((c) => c.call_id)
          .map((c) => ({
            call_id: c.call_id as string,
            tool_name: c.tool_name,
            tool_args: c.tool_args,
            tool_result: c.tool_result,
            tool_ts: c.tool_ts,
          }))
      : undefined,
  };
}

/** Liste DTO'su (thesis_md yok) → frontend Thesis. Detay görüntüsü için get ile fetch'le. */
export function adaptThesisSummary(s: BackendThesisSummary): Thesis {
  const synthetic: BackendThesis = {
    ...s,
    thesis_md: null,
    confidence_breakdown: null,
    memory_hits: [],
    price_at_thesis: null,
    price_7d: null,
    price_30d: null,
    price_90d: null,
    ground_truth_return: null,
  } as unknown as BackendThesis;
  return adaptThesis(synthetic);
}
