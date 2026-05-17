import type { AgentMeta } from "./types";

/**
 * Backend pipeline'ındaki 7 gerçek agent ile birebir hizalı liste.
 * (`backend/app/agents/orchestrator.py` → sector_router, macro, memory, technical,
 * fundamental, devils_advocate, synthesizer)
 */
export const AGENT_REGISTRY: AgentMeta[] = [
  {
    id: "sector-router",
    name: "Sektör Yönlendirici",
    role: "Squad atama",
    mandate:
      "Şirketin hangi sektör/squad'a ait olduğunu belirler; uygun temel analiz şablonunu seçer.",
    tone: "violet",
    icon: "Compass",
  },
  {
    id: "macro",
    name: "Makro Bağlam",
    role: "TCMB & global göstergeler",
    mandate:
      "USD/TRY, EUR/TRY, TÜFE, politika faizi, BIST100 ve Brent gibi göstergeleri özetler.",
    tone: "cyan",
    icon: "Globe",
  },
  {
    id: "memory",
    name: "Bellek",
    role: "Tarihsel benzerlik",
    mandate:
      "Geçmiş tezleri embedding benzerliğiyle arar; aynı ticker veya squad'tan emsalleri getirir.",
    tone: "warn",
    icon: "History",
  },
  {
    id: "technical",
    name: "Teknik Analist",
    role: "Trend & momentum",
    mandate:
      "Fiyat aksiyonu, RSI, MACD, SMA/EMA, hacim profili ve destek/direnç haritası çıkarır.",
    tone: "cyan",
    icon: "LineChart",
  },
  {
    id: "fundamental",
    name: "Temel Analist",
    role: "Bilanço & değerleme",
    mandate:
      "KAP bildirimleri, mali tablolar ve rasyolardan squad'a özgü temel skor üretir.",
    tone: "bull",
    icon: "Calculator",
  },
  {
    id: "devils-advocate",
    name: "Şeytan Avukatı",
    role: "Karşıt argüman",
    mandate:
      "Her bull argümanını sorgular, gözden kaçan riskleri ve baz oranı uyarılarını öne çıkarır.",
    tone: "bear",
    icon: "ShieldAlert",
  },
  {
    id: "synthesizer",
    name: "Sentez",
    role: "Konsensüs & güven",
    mandate:
      "Tüm ajan çıktısını okur, bull/bear/katalist sentezi yazar ve kalibre güven skoru atar.",
    tone: "primary",
    icon: "Sparkles",
  },
];

export const AGENT_COUNT = AGENT_REGISTRY.length;

export function getAgent(id: string): AgentMeta | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
