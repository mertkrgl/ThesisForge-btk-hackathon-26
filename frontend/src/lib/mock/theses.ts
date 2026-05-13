import type { Thesis } from "./types";

export const MOCK_THESES: Thesis[] = [
  {
    id: "th_tuprs_20260513",
    ticker: "TUPRS",
    company: "Tüpraş",
    sector: "Enerji · Rafineri",
    createdAt: "2026-05-13T09:42:00Z",
    verdict: "bull",
    confidence: 67,
    oneLiner:
      "FAVÖK marjı toparlanması ve katalist takvimi olumlu; küresel spread riski sınırlandı.",
    bull: [
      {
        text: "3Ç bilançosu beklentinin %6 üzerinde geldi; FAVÖK marjı %14.2 ile yükseliş trendinde.",
        sources: ["KAP-24Q3", "EVDS-CPI-Q3"],
      },
      {
        text: "Net borç/FAVÖK oranı 1.1x ile sektör ortalamasının altında.",
        sources: ["KAP-24Q3"],
      },
      {
        text: "Kapasite kullanım oranı %92'ye yükseldi, marj kalıcılığını destekliyor.",
        sources: ["TUPRS-OPS-Q3"],
      },
    ],
    bear: [
      {
        text: "Global resesyon senaryosunda ürün spread'leri zayıflayabilir.",
        sources: ["IEA-OutlookQ4"],
      },
      {
        text: "4Ç'de tek seferlik bakım gideri öngörülüyor; kazanç volatil olabilir.",
        sources: ["TUPRS-GUIDE-24"],
      },
    ],
    catalysts: [
      {
        text: "4Ç bilanço açıklaması: 2026-02-18.",
        sources: ["KAP-CAL"],
      },
      {
        text: "TCMB faiz toplantısı: 2026-06-26 — kurda dalgalanma katalisti.",
        sources: ["EVDS-CAL"],
      },
    ],
    agents: [
      {
        id: "technical",
        summary:
          "168 TL üzerinde 20G EMA testi tamamlandı; RSI 58 ile momentum nötr-pozitif.",
        confidence: 58,
      },
      {
        id: "fundamental",
        summary:
          "FAVÖK marjı %14.2, F/K 6.8x. Bilanço beklentiyi aştı, kalite yüksek.",
        confidence: 72,
      },
      {
        id: "devil",
        summary:
          "Spread daralma riski + bakım gideri 4Ç'de kazançta gürültü yaratabilir.",
        confidence: 54,
      },
      {
        id: "synthesizer",
        summary:
          "Bull/bear dengelendi; katalist takvimi ağır basıyor. Net pozisyon: tutmaya değer.",
        confidence: 67,
      },
      {
        id: "memory",
        summary:
          "2023Q3 benzer marj toparlanması sonrası 6 ay içinde %22 nominal getiri.",
        confidence: 62,
      },
      {
        id: "catalyst",
        summary:
          "4Ç bilanço (Şub) + TCMB toplantısı (Haz) iki büyük katalist.",
        confidence: 70,
      },
      {
        id: "sentiment",
        summary:
          "Türkçe finansal haber akışında nötr-pozitif eğilim; sosyal hacim sakin.",
        confidence: 55,
      },
      {
        id: "risk",
        summary:
          "30G volatilite tarihsel ortalamada; pozisyon büyüklüğüne uygun.",
        confidence: 64,
      },
    ],
    sources: [
      { id: "KAP-24Q3", label: "KAP 3Ç 2024 Konsolide Bilanço", kind: "kap" },
      { id: "EVDS-CPI-Q3", label: "TCMB EVDS · TÜFE Q3", kind: "evds" },
      { id: "BIST-PX", label: "BIST Primary fiyat akışı", kind: "bist" },
      { id: "IEA-OutlookQ4", label: "IEA · Petrol Q4 Görünüm", kind: "filing" },
      { id: "TUPRS-OPS-Q3", label: "Tüpraş 3Ç Operasyonel Rapor", kind: "filing" },
      { id: "TUPRS-GUIDE-24", label: "Tüpraş 2024 Beklenti Notu", kind: "kap" },
      { id: "KAP-CAL", label: "KAP Bilanço Takvimi", kind: "kap" },
      { id: "EVDS-CAL", label: "TCMB Toplantı Takvimi", kind: "evds" },
    ],
    kpis: [
      { label: "Son", value: "172.40", delta: "+1.8%", tone: "bull" },
      { label: "F/K", value: "6.8x", tone: "primary" },
      { label: "FAVÖK Marjı", value: "%14.2", delta: "+0.6pp", tone: "bull" },
      { label: "Net Borç/FAVÖK", value: "1.1x", tone: "cyan" },
    ],
  },
  {
    id: "th_asels_20260512",
    ticker: "ASELS",
    company: "Aselsan",
    sector: "Savunma · Elektronik",
    createdAt: "2026-05-12T14:08:00Z",
    verdict: "bull",
    confidence: 74,
    oneLiner:
      "Yüksek backlog ve ihracat ivmesi tezi destekliyor; kur kazançları riski sınırlı.",
    bull: [
      {
        text: "Backlog 12.6 mlr USD'ye ulaştı; 2026'da revenue dönüşüm oranı %38.",
        sources: ["KAP-ASELS-Q3"],
      },
      {
        text: "İhracat geliri yıllık %42 büyüdü, marj koruyucu etki yarattı.",
        sources: ["ASELS-IR"],
      },
    ],
    bear: [
      {
        text: "Yüksek değerleme katsayısı; F/K 24x üzerinde.",
        sources: ["BIST-PX"],
      },
    ],
    catalysts: [
      {
        text: "Yeni ihracat kontratı duyurusu bekleniyor.",
        sources: ["ASELS-IR"],
      },
    ],
    agents: [
      { id: "technical", summary: "Kanal üst sınırı yakın; pull-back fırsatı.", confidence: 60 },
      { id: "fundamental", summary: "Backlog kalitesi yüksek, marjlar dirençli.", confidence: 78 },
      { id: "devil", summary: "Değerleme premium; momentum kaybı riski var.", confidence: 50 },
      { id: "synthesizer", summary: "Pozitif ama agresif giriş yerine ölçülü.", confidence: 74 },
      { id: "memory", summary: "Benzer backlog yapısında ortalama getiri %18/yıl.", confidence: 70 },
      { id: "catalyst", summary: "İhracat duyurusu ana katalist.", confidence: 72 },
      { id: "sentiment", summary: "Algı çok pozitif, balık balığı yiyebilir.", confidence: 58 },
      { id: "risk", summary: "Vol artıyor; pozisyon ölçeği düşür.", confidence: 55 },
    ],
    sources: [
      { id: "KAP-ASELS-Q3", label: "KAP Aselsan 3Ç 2024", kind: "kap" },
      { id: "ASELS-IR", label: "Aselsan Yatırımcı Sunumu", kind: "filing" },
      { id: "BIST-PX", label: "BIST Primary fiyat akışı", kind: "bist" },
    ],
    kpis: [
      { label: "Son", value: "112.80", delta: "+3.2%", tone: "bull" },
      { label: "F/K", value: "24.6x", tone: "warn" },
      { label: "Backlog", value: "12.6B$", tone: "primary" },
      { label: "İhracat %", value: "%42", delta: "+12pp", tone: "bull" },
    ],
  },
  {
    id: "th_eregl_20260510",
    ticker: "EREGL",
    company: "Ereğli Demir Çelik",
    sector: "Metal · Demir-Çelik",
    createdAt: "2026-05-10T11:30:00Z",
    verdict: "neutral",
    confidence: 48,
    oneLiner:
      "Çelik fiyatları zayıf; iç talep destekli ama global tablo belirsiz.",
    bull: [
      {
        text: "İç talep, altyapı yatırımlarıyla destekleniyor.",
        sources: ["EVDS-INFRA"],
      },
    ],
    bear: [
      {
        text: "Çin'den ihracat baskısı global çelik fiyatlarını baskılıyor.",
        sources: ["IEA-OutlookQ4"],
      },
      {
        text: "Maliyet enflasyonu marjlara baskı yapıyor.",
        sources: ["EVDS-CPI-Q3"],
      },
    ],
    catalysts: [
      {
        text: "Çin uyaranı veya çelik kotası — global fiyat katalisti.",
        sources: ["IEA-OutlookQ4"],
      },
    ],
    agents: [
      { id: "technical", summary: "Sıkışma bandı; yön belirsiz.", confidence: 45 },
      { id: "fundamental", summary: "Marj baskısı sürüyor.", confidence: 42 },
      { id: "devil", summary: "Yapısal aşırı arz riski.", confidence: 60 },
      { id: "synthesizer", summary: "Tarafsız; izle modu.", confidence: 48 },
      { id: "memory", summary: "Benzer dönemlerde yatay seyir.", confidence: 50 },
      { id: "catalyst", summary: "Dış katalist olmadan hareket sınırlı.", confidence: 44 },
      { id: "sentiment", summary: "Algı nötr-negatif.", confidence: 40 },
      { id: "risk", summary: "Vol düşük; bekleme makul.", confidence: 60 },
    ],
    sources: [
      { id: "EVDS-INFRA", label: "TCMB EVDS · Altyapı Yatırımları", kind: "evds" },
      { id: "EVDS-CPI-Q3", label: "TCMB EVDS · TÜFE Q3", kind: "evds" },
      { id: "IEA-OutlookQ4", label: "IEA · Çelik Q4 Görünüm", kind: "filing" },
    ],
    kpis: [
      { label: "Son", value: "32.18", delta: "-0.4%", tone: "bear" },
      { label: "F/K", value: "11.2x", tone: "primary" },
      { label: "FAVÖK Marjı", value: "%9.4", delta: "-1.1pp", tone: "bear" },
      { label: "Temettü Verimi", value: "%5.6", tone: "bull" },
    ],
  },
  {
    id: "th_thyao_20260508",
    ticker: "THYAO",
    company: "Türk Hava Yolları",
    sector: "Ulaştırma · Havacılık",
    createdAt: "2026-05-08T08:15:00Z",
    verdict: "bull",
    confidence: 61,
    oneLiner:
      "Yolcu trafiği güçlü, yakıt maliyeti yatay; kur riski izlenmeli.",
    bull: [
      {
        text: "Yolcu sayısı yıllık %14 arttı; doluluk %83.",
        sources: ["KAP-THYAO-Q3"],
      },
    ],
    bear: [
      {
        text: "Yüksek kur volatilitesi nakit akışını etkileyebilir.",
        sources: ["EVDS-FX"],
      },
    ],
    catalysts: [
      {
        text: "Yaz dönemi trafik verisi: 2026-09-15 KAP raporu.",
        sources: ["KAP-CAL"],
      },
    ],
    agents: [
      { id: "technical", summary: "Yukarı kanal; pull-back desteği güçlü.", confidence: 60 },
      { id: "fundamental", summary: "Operasyonel KPI'lar güçlü.", confidence: 68 },
      { id: "devil", summary: "FX gürültüsü kazançta volatilite üretir.", confidence: 50 },
      { id: "synthesizer", summary: "Yumuşak pozitif; risk yönetimi öncelikli.", confidence: 61 },
      { id: "memory", summary: "Yaz dönemleri tarihsel olarak pozitif.", confidence: 65 },
      { id: "catalyst", summary: "Yaz trafik açıklaması ana katalist.", confidence: 62 },
      { id: "sentiment", summary: "Algı pozitif, hype yok.", confidence: 58 },
      { id: "risk", summary: "Pozisyon ölçeği orta; FX hedge düşün.", confidence: 55 },
    ],
    sources: [
      { id: "KAP-THYAO-Q3", label: "KAP THY 3Ç 2024", kind: "kap" },
      { id: "EVDS-FX", label: "TCMB EVDS · Kur Serileri", kind: "evds" },
      { id: "KAP-CAL", label: "KAP Bilanço Takvimi", kind: "kap" },
    ],
    kpis: [
      { label: "Son", value: "284.50", delta: "+0.9%", tone: "bull" },
      { label: "F/K", value: "8.4x", tone: "primary" },
      { label: "Doluluk", value: "%83", delta: "+2pp", tone: "bull" },
      { label: "Net Marj", value: "%11.8", tone: "cyan" },
    ],
  },
];

export function getThesisById(id: string): Thesis | undefined {
  return MOCK_THESES.find((t) => t.id === id);
}

export function listThesesByTicker(ticker?: string): Thesis[] {
  if (!ticker) return MOCK_THESES;
  return MOCK_THESES.filter((t) => t.ticker === ticker.toUpperCase());
}
