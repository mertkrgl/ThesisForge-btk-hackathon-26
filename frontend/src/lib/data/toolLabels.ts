import type { Source } from "@/lib/mock/types";

/**
 * Backend tool_call_logs.tool_name → kullanıcı dostu kaynak etiketi + kind.
 * Frontend SourceChip için renk kodlaması bu eşlemeden gelir.
 */
type ToolMeta = { label: string; kind: Source["kind"] };

export const TOOL_LABELS: Record<string, ToolMeta> = {
  get_ohlcv: { label: "Fiyat Verisi (yfinance)", kind: "bist" },
  calculate_indicators: { label: "Teknik İndikatörler", kind: "bist" },
  detect_patterns: { label: "Formasyon Tespiti", kind: "bist" },
  find_support_resistance: { label: "Destek/Direnç", kind: "bist" },
  relative_strength: { label: "Göreceli Güç", kind: "bist" },
  fetch_kap_filings: { label: "KAP Bildirimleri", kind: "kap" },
  get_financial_statements: { label: "Mali Tablolar", kind: "filing" },
  compute_ratios: { label: "Finansal Rasyolar", kind: "filing" },
  compare_to_peers: { label: "Sektör Karşılaştırma", kind: "filing" },
  get_dividend_history: { label: "Temettü Geçmişi", kind: "filing" },
  get_tcmb_indicators: { label: "TCMB Göstergeleri (EVDS)", kind: "evds" },
  get_bist_index_state: { label: "BIST 100 Endeksi", kind: "bist" },
  get_global_signals: { label: "Global Sinyaller", kind: "news" },
  get_mkk_data: { label: "MKK Verisi", kind: "mkk" },
};

export function toolToSource(
  callId: string,
  toolName: string | null,
): Source {
  if (toolName && TOOL_LABELS[toolName]) {
    const meta = TOOL_LABELS[toolName];
    return { id: callId, label: meta.label, kind: meta.kind };
  }
  return {
    id: callId,
    label: toolName ? toolName : "Kaynak",
    kind: "filing",
  };
}
