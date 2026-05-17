/**
 * Tool sonucu (tool_result JSONB) → popover detayı.
 *
 * Her tool için:
 *  - `summary`: 1-2 satır insan dostu özet (örn. "MACD: 14.5 | RSI: 56.3")
 *  - `fields`: key-value tablosu (label → değer)
 *  - `externalUrl`: gerçek external kaynak varsa URL, yoksa null
 *  - `externalLabel`: link butonunun metni ("KAP'ta aç", "Yahoo Finance'da aç" vb.)
 *
 * NOT: tool_args üzerinden ticker'ı çıkarıp ticker-bazlı deep link'ler üretir.
 *
 * Indicator/computed tool'lar için "gerçek URL" yok — kaynak veriyi sağlayan
 * sitenin ticker sayfasına yönlendirir (yfinance, isyatirim).
 */
import type { CitationDetail } from "@/lib/mock/types";

const numFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});
const intFormatter = new Intl.NumberFormat("tr-TR");

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    return Number.isInteger(v) ? intFormatter.format(v) : numFormatter.format(v);
  }
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v === "string") return v;
  return JSON.stringify(v).slice(0, 80);
}

function getTicker(args: Record<string, unknown> | null): string | null {
  const t = args?.ticker;
  return typeof t === "string" && t.length > 0 ? t.toUpperCase() : null;
}

function yfTicker(t: string): string {
  return t.startsWith("^") || t.includes(".") ? t : `${t}.IS`;
}

export type ToolDetail = {
  label: string;
  source: string | null;
  fetchedAt: string | null;
  args: string | null;
  fields: Array<{ label: string; value: string }>;
  externalUrl: string | null;
  externalLabel: string | null;
};

type ToolHandler = (
  cit: CitationDetail,
  ticker: string | null,
) => Pick<ToolDetail, "label" | "fields" | "externalUrl" | "externalLabel">;

function payloadOf(cit: CitationDetail): Record<string, unknown> {
  const p = cit.tool_result?.payload;
  return (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
}

function rootOf(cit: CitationDetail): Record<string, unknown> {
  return (cit.tool_result ?? {}) as Record<string, unknown>;
}

const HANDLERS: Record<string, ToolHandler> = {
  calculate_indicators: (cit, ticker) => {
    const payload = payloadOf(cit);
    const ind = (payload.indicators ?? {}) as Record<string, unknown>;
    const sig = (payload.signal ?? {}) as Record<string, unknown>;
    const fields = [
      { label: "MACD", value: fmt(ind.macd) },
      { label: "MACD Signal", value: fmt(ind.macd_signal) },
      { label: "MACD Hist.", value: fmt(ind.macd_hist) },
      { label: "RSI (14)", value: fmt(ind.rsi_14) },
      { label: "EMA 12", value: fmt(ind.ema_12) },
      { label: "SMA 20", value: fmt(ind.sma_20) },
      { label: "SMA 50", value: fmt(ind.sma_50) },
      { label: "Bollinger Üst", value: fmt(ind.bb_upper) },
      { label: "Bollinger Orta", value: fmt(ind.bb_middle) },
      { label: "Bollinger Alt", value: fmt(ind.bb_lower) },
      { label: "ATR (14)", value: fmt(ind.atr_14) },
      { label: "Son Kapanış", value: fmt(ind.last_close) },
      { label: "Hacim Ort. (20)", value: fmt(ind.volume_avg_20) },
      { label: "Trend Sinyali", value: fmt(sig.trend) },
      { label: "Momentum", value: fmt(sig.momentum) },
      { label: "Volatilite", value: fmt(sig.volatility) },
    ].filter((f) => f.value !== "—");
    return {
      label: "Teknik İndikatörler",
      fields,
      externalUrl: ticker
        ? `https://finance.yahoo.com/quote/${yfTicker(ticker)}`
        : null,
      externalLabel: "Yahoo Finance'da fiyat verisi",
    };
  },

  get_ohlcv: (cit, ticker) => {
    const payload = payloadOf(cit);
    const fields = [
      { label: "Satır sayısı", value: fmt(payload.rows) },
      { label: "İlk kapanış", value: fmt(payload.first_close) },
      { label: "Son kapanış", value: fmt(payload.last_close) },
    ].filter((f) => f.value !== "—");
    return {
      label: "Fiyat Verisi (OHLCV)",
      fields,
      externalUrl: ticker
        ? `https://finance.yahoo.com/quote/${yfTicker(ticker)}/history`
        : null,
      externalLabel: "Yahoo Finance geçmişi",
    };
  },

  detect_patterns: (cit) => {
    const payload = payloadOf(cit);
    const patterns = Array.isArray(payload.patterns) ? payload.patterns : [];
    const fields = patterns.slice(0, 6).map((p, i) => {
      if (typeof p === "string") return { label: `Formasyon ${i + 1}`, value: p };
      if (p && typeof p === "object") {
        const obj = p as Record<string, unknown>;
        const name = fmt(obj.name ?? obj.pattern ?? obj.type);
        const note = obj.signal ?? obj.confidence ?? obj.note;
        return {
          label: name,
          value: note != null ? fmt(note) : "tespit edildi",
        };
      }
      return { label: `Formasyon ${i + 1}`, value: fmt(p) };
    });
    if (fields.length === 0) {
      fields.push({ label: "Sonuç", value: "Formasyon tespit edilmedi" });
    }
    return {
      label: "Formasyon Tespiti",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },

  find_support_resistance: (cit) => {
    const payload = payloadOf(cit);
    const sup = Array.isArray(payload.support) ? payload.support : [];
    const res = Array.isArray(payload.resistance) ? payload.resistance : [];
    const fields: Array<{ label: string; value: string }> = [];
    sup.slice(0, 3).forEach((v, i) =>
      fields.push({ label: `Destek ${i + 1}`, value: fmt(v) }),
    );
    res.slice(0, 3).forEach((v, i) =>
      fields.push({ label: `Direnç ${i + 1}`, value: fmt(v) }),
    );
    return {
      label: "Destek / Direnç",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },

  relative_strength: (cit, ticker) => {
    const payload = payloadOf(cit);
    const fields = [
      { label: "Hisse getirisi", value: fmt(payload.stock_return) },
      { label: "Endeks getirisi", value: fmt(payload.index_return) },
      { label: "Göreceli güç", value: fmt(payload.relative_strength) },
      { label: "Endeks", value: fmt(payload.index_code) },
    ].filter((f) => f.value !== "—");
    return {
      label: "Göreceli Güç (vs Endeks)",
      fields,
      externalUrl: ticker
        ? `https://finance.yahoo.com/quote/${yfTicker(ticker)}`
        : null,
      externalLabel: "Yahoo Finance",
    };
  },

  fetch_kap_filings: (cit) => {
    const payload = payloadOf(cit);
    const disc = Array.isArray(payload.disclosures) ? payload.disclosures : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Bildirim sayısı", value: fmt(payload.count ?? disc.length) },
    ];
    disc.slice(0, 4).forEach((d) => {
      if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        const date = String(o.publishDate ?? "").slice(0, 16);
        const subject = String(o.subject ?? "KAP bildirimi");
        fields.push({ label: date || "—", value: subject });
      }
    });
    // İlk bildirimi external link olarak öner
    const first = disc[0] as Record<string, unknown> | undefined;
    const idx = first?.disclosureIndex;
    const externalUrl =
      idx != null && idx !== ""
        ? `https://www.kap.org.tr/tr/Bildirim/${idx}`
        : "https://www.kap.org.tr/";
    return {
      label: "KAP Bildirimleri",
      fields,
      externalUrl,
      externalLabel: idx ? "KAP'ta bildirimi aç" : "KAP",
    };
  },

  get_financial_statements: (cit, ticker) => {
    const payload = payloadOf(cit);
    const fields: Array<{ label: string; value: string }> = [];
    // Beklenen şekil: { period: {...metrics...}, statements: {...} } — esnek
    for (const [k, v] of Object.entries(payload).slice(0, 8)) {
      if (typeof v === "number" || typeof v === "string") {
        fields.push({ label: k, value: fmt(v) });
      }
    }
    return {
      label: "Mali Tablolar",
      fields,
      externalUrl: ticker
        ? `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${ticker}`
        : null,
      externalLabel: "İş Yatırım şirket kartı",
    };
  },

  compute_ratios: (cit, ticker) => {
    const payload = payloadOf(cit);
    const ratios = (payload.ratios ?? payload) as Record<string, unknown>;
    const fields = Object.entries(ratios)
      .filter(([, v]) => typeof v === "number" || typeof v === "string")
      .slice(0, 10)
      .map(([k, v]) => ({ label: k, value: fmt(v) }));
    return {
      label: "Finansal Rasyolar",
      fields,
      externalUrl: ticker
        ? `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${ticker}`
        : null,
      externalLabel: "İş Yatırım rasyolar",
    };
  },

  compare_to_peers: (cit, ticker) => {
    const root = rootOf(cit);
    const peers = Array.isArray(root.peers) ? root.peers : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Sektör (squad)", value: fmt(root.squad) },
      { label: "Peer sayısı", value: fmt(peers.length) },
    ];
    peers.slice(0, 5).forEach((p) => {
      if (typeof p === "string") fields.push({ label: "Peer", value: p });
      else if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        fields.push({
          label: fmt(o.ticker ?? o.name),
          value: fmt(o.metric ?? o.value ?? ""),
        });
      }
    });
    return {
      label: "Sektör Karşılaştırma",
      fields,
      externalUrl: ticker
        ? `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${ticker}`
        : null,
      externalLabel: "İş Yatırım",
    };
  },

  get_sector_peers: (cit) => {
    const root = rootOf(cit);
    const peers = Array.isArray(root.peers) ? root.peers : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Sektör", value: fmt(root.squad) },
      { label: "Peer sayısı", value: fmt(peers.length) },
    ];
    peers.slice(0, 8).forEach((p) => {
      fields.push({ label: "Peer", value: fmt(p) });
    });
    return {
      label: "Sektör Şirketleri",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },

  get_dividend_history: (cit, ticker) => {
    const payload = payloadOf(cit);
    const divs = Array.isArray(payload.dividends) ? payload.dividends : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Temettü ödemesi", value: fmt(divs.length) },
    ];
    divs.slice(0, 4).forEach((d) => {
      if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        fields.push({
          label: String(o.date ?? "—").slice(0, 10),
          value: fmt(o.amount ?? o.value),
        });
      }
    });
    return {
      label: "Temettü Geçmişi",
      fields,
      externalUrl: ticker
        ? `https://finance.yahoo.com/quote/${yfTicker(ticker)}/history?filter=div`
        : null,
      externalLabel: "Yahoo Finance temettü",
    };
  },

  get_tcmb_indicators: (cit) => {
    const payload = payloadOf(cit);
    const fields = Object.entries(payload)
      .filter(([, v]) => typeof v === "number" || typeof v === "string")
      .slice(0, 10)
      .map(([k, v]) => ({ label: k, value: fmt(v) }));
    return {
      label: "TCMB Göstergeleri (EVDS)",
      fields,
      externalUrl: "https://evds2.tcmb.gov.tr/",
      externalLabel: "EVDS dashboard",
    };
  },

  get_bist_index_state: (cit) => {
    const payload = payloadOf(cit);
    const fields = [
      { label: "Endeks", value: fmt(payload.index_code ?? "XU100") },
      { label: "Son", value: fmt(payload.last) },
      { label: "Önceki kapanış", value: fmt(payload.previous_close) },
      { label: "Değişim %", value: fmt(payload.delta_pct) },
    ].filter((f) => f.value !== "—");
    return {
      label: "BIST 100 Endeksi",
      fields,
      externalUrl: "https://finance.yahoo.com/quote/XU100.IS",
      externalLabel: "Yahoo Finance · XU100",
    };
  },

  get_global_signals: (cit) => {
    const root = rootOf(cit);
    const usd = (root.usd ?? {}) as Record<string, unknown>;
    const brent = (root.brent ?? {}) as Record<string, unknown>;
    const fields = [
      { label: "USDTRY son", value: fmt(usd.last ?? usd.value) },
      { label: "USDTRY %", value: fmt(usd.delta_pct) },
      { label: "Brent son", value: fmt(brent.last ?? brent.value) },
      { label: "Brent %", value: fmt(brent.delta_pct) },
    ].filter((f) => f.value !== "—");
    return {
      label: "Global Sinyaller",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },

  get_recent_macro_news: (cit) => {
    const payload = payloadOf(cit);
    const news = Array.isArray(payload.news) ? payload.news : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Haber sayısı", value: fmt(news.length) },
    ];
    news.slice(0, 4).forEach((n) => {
      if (n && typeof n === "object") {
        const o = n as Record<string, unknown>;
        fields.push({
          label: String(o.source ?? "Haber").slice(0, 30),
          value: String(o.title ?? "").slice(0, 80),
        });
      }
    });
    const first = news[0] as Record<string, unknown> | undefined;
    const url = typeof first?.url === "string" ? first.url : null;
    return {
      label: "Makro Haberler",
      fields,
      externalUrl: url,
      externalLabel: url ? "İlk haberi aç" : null,
    };
  },

  find_disconfirming_evidence: (cit) => {
    const root = rootOf(cit);
    const snap = (root.news_snapshot ?? {}) as Record<string, unknown>;
    const items = Array.isArray(snap.news) ? snap.news : [];
    const fields: Array<{ label: string; value: string }> = [
      { label: "Karşıt sinyal", value: fmt(items.length) + " adet" },
    ];
    items.slice(0, 4).forEach((n) => {
      if (n && typeof n === "object") {
        const o = n as Record<string, unknown>;
        fields.push({
          label: String(o.source ?? "Haber").slice(0, 24),
          value: String(o.title ?? "").slice(0, 80),
        });
      }
    });
    const first = items[0] as Record<string, unknown> | undefined;
    const url = typeof first?.url === "string" ? first.url : null;
    return {
      label: "Karşıt Kanıt Taraması",
      fields,
      externalUrl: url,
      externalLabel: url ? "Karşıt haberi aç" : null,
    };
  },

  base_rate_check: (cit) => {
    const root = rootOf(cit);
    const fields = [
      { label: "Sektör", value: fmt(root.squad) },
      { label: "Başarı oranı %", value: fmt(root.success_rate_pct) },
      { label: "Toplam tez", value: fmt(root.total_completed) },
    ].filter((f) => f.value !== "—");
    return {
      label: "Geçmiş Tez Baz Oranı",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },

  query_workers: (cit) => {
    const root = rootOf(cit);
    const fields: Array<{ label: string; value: string }> = [];
    for (const k of ["technical", "fundamental"] as const) {
      const v = root[k];
      if (v != null) {
        const summary =
          typeof v === "string" ? v : JSON.stringify(v).slice(0, 100);
        fields.push({ label: k === "technical" ? "Teknik" : "Temel", value: summary });
      }
    }
    return {
      label: "Worker Sorgu Sonuçları",
      fields,
      externalUrl: null,
      externalLabel: null,
    };
  },
};

const FALLBACK_LABEL: Record<string, string> = {
  base_rate_check: "Geçmiş Tez Baz Oranı",
  query_workers: "Worker Sorgu Sonuçları",
};

export function describeTool(cit: CitationDetail): ToolDetail {
  const tool = cit.tool_name ?? "";
  const ticker = getTicker(cit.tool_args);
  const handler = HANDLERS[tool];
  const args = cit.tool_args ? formatArgs(cit.tool_args) : null;
  const source = (cit.tool_result?.source as string | undefined) ?? null;
  const fetchedAt =
    (cit.tool_result?.fetched_at as string | undefined) ?? cit.tool_ts ?? null;

  if (handler) {
    const detail = handler(cit, ticker);
    return {
      ...detail,
      source,
      fetchedAt,
      args,
    };
  }

  return {
    label: FALLBACK_LABEL[tool] ?? tool ?? "Kaynak",
    source,
    fetchedAt,
    args,
    fields: [],
    externalUrl: null,
    externalLabel: null,
  };
}

function formatArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v == null) continue;
    if (typeof v === "object") continue;
    parts.push(`${k}=${v}`);
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}
