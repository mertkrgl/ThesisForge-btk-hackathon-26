import type { AgentMeta } from "./types";

export const AGENT_REGISTRY: AgentMeta[] = [
  {
    id: "technical",
    name: "Teknik Analist",
    role: "Trend & momentum",
    mandate:
      "Fiyat aksiyonu, RSI, MACD ve hacim profilini değerlendirir. Destek/direnç haritası çıkarır.",
    tone: "cyan",
    icon: "LineChart",
  },
  {
    id: "fundamental",
    name: "Temel Analist",
    role: "Bilanço & değerleme",
    mandate:
      "KAP bildirimleri, ürün gelirleri, FAVÖK marjı ve F/K oranlarını işler. Düzeltilmiş kazanç modeli kurar.",
    tone: "bull",
    icon: "Calculator",
  },
  {
    id: "devil",
    name: "Şeytan Avukatı",
    role: "Karşıt argüman",
    mandate:
      "Her bull argümanına karşı tezi gözden geçirir, görmezden gelinen riskleri öne çıkarır.",
    tone: "bear",
    icon: "ShieldAlert",
  },
  {
    id: "synthesizer",
    name: "Sentez",
    role: "Konsensüs & güven",
    mandate:
      "Tüm ajanları okur, bull/bear/katalist sentezi üretir, kalibre edilmiş bir güven skoru atar.",
    tone: "violet",
    icon: "Sparkles",
  },
  {
    id: "memory",
    name: "Bellek",
    role: "Tarihsel benzerlik",
    mandate:
      "Geçmiş tezleri ve benzer makro koşulları arar. Hangi tezlerin gerçekleştiğini hatırlatır.",
    tone: "warn",
    icon: "History",
  },
  {
    id: "catalyst",
    name: "Katalist Avcısı",
    role: "Olay haritası",
    mandate:
      "Bilanço dönemleri, TCMB toplantıları, KAP MKK olaylarını bir zaman çizelgesine yerleştirir.",
    tone: "primary",
    icon: "Zap",
  },
  {
    id: "sentiment",
    name: "Algı",
    role: "Haber & sosyal",
    mandate:
      "Türkçe haber ve sosyal medya akışından duygu skoru çıkarır; gürültüyü filtreler.",
    tone: "violet",
    icon: "Radio",
  },
  {
    id: "risk",
    name: "Risk Yönetimi",
    role: "Pozisyon mühendisliği",
    mandate:
      "Volatilite ve drawdown profiline göre uyarı bayrakları kaldırır, pozisyon büyüklüğünü değerlendirir.",
    tone: "bear",
    icon: "AlertTriangle",
  },
];

export function getAgent(id: string): AgentMeta | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
