import type { Source } from "@/lib/mock/types";

/**
 * Backend tool_call_logs.tool_name → kullanıcı dostu kaynak etiketi + kind.
 * Frontend SourceChip için renk kodlaması bu eşlemeden gelir.
 */
type ToolMeta = { label: string; kind: Source["kind"] };

export const TOOL_LABELS: Record<string, ToolMeta> = {
  // Teknik
  get_ohlcv: { label: "Fiyat Geçmişi", kind: "bist" },
  calculate_indicators: { label: "Teknik İndikatörler", kind: "bist" },
  detect_patterns: { label: "Formasyon Tespiti", kind: "bist" },
  find_support_resistance: { label: "Destek/Direnç Seviyeleri", kind: "bist" },
  relative_strength: { label: "Göreceli Güç (XU100)", kind: "bist" },
  // Temel
  fetch_kap_filings: { label: "KAP Bildirimleri", kind: "kap" },
  get_financial_statements: { label: "Mali Tablolar", kind: "filing" },
  compute_ratios: { label: "Finansal Rasyolar", kind: "filing" },
  get_sector_peers: { label: "Sektör Emsalleri", kind: "filing" },
  compare_to_peers: { label: "Sektör Karşılaştırma", kind: "filing" },
  get_dividend_history: { label: "Temettü Geçmişi", kind: "filing" },
  // Makro
  get_tcmb_indicators: { label: "TCMB Göstergeleri (EVDS)", kind: "evds" },
  get_bist_index_state: { label: "BIST 100 Endeksi", kind: "bist" },
  get_global_signals: { label: "Global Piyasa Sinyalleri", kind: "news" },
  recent_macro_news: { label: "Güncel Makro Haberler", kind: "news" },
  get_mkk_data: { label: "MKK Verisi", kind: "mkk" },
  // Devil's Advocate
  query_workers: { label: "Worker Sorgulama", kind: "filing" },
  disconfirming_evidence: { label: "Karşı Kanıt Aramaları", kind: "news" },
  base_rate_check: { label: "Sektör Başarı Oranı", kind: "filing" },
  // Memory
  similarity_search: { label: "Benzer Tez Eşleşmesi", kind: "filing" },
};

export function toolToSource(
  callId: string,
  toolName: string | null,
): Source {
  if (toolName && TOOL_LABELS[toolName]) {
    const meta = TOOL_LABELS[toolName];
    return { id: callId, label: meta.label, kind: meta.kind };
  }
  // Bilinmeyen tool için ham snake_case adı kullanıcıya gösterme — generic
  // "Kaynak" etiketi yatırımcı dilini koruyor (P0-5).
  return { id: callId, label: "Kaynak", kind: "filing" };
}
