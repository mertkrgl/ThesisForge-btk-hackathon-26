/**
 * BIST tickerları için kullanıcı dostu şirket isimleri.
 * Backend ticker döner, frontend kart başlığında okunaklı isim göstermek için
 * burada haritalanır. Bilinmeyen ticker fallback olarak kendi sembolü gösterilir.
 */
export const COMPANY_NAMES: Record<string, string> = {
  AEFES: "Anadolu Efes",
  AKBNK: "Akbank",
  AKSA: "Aksa Akrilik",
  AKSEN: "Aksa Enerji",
  ALARK: "Alarko Holding",
  ARCLK: "Arçelik",
  ASELS: "Aselsan",
  ASTOR: "Astor Enerji",
  BIMAS: "BİM",
  BRSAN: "Borusan Mannesmann",
  CIMSA: "Çimsa",
  DOAS: "Doğuş Otomotiv",
  EKGYO: "Emlak Konut GYO",
  ENJSA: "Enerjisa",
  ENKAI: "Enka İnşaat",
  EREGL: "Ereğli Demir Çelik",
  FROTO: "Ford Otosan",
  GARAN: "Garanti BBVA",
  GUBRF: "Gübre Fabrikaları",
  HALKB: "Halkbank",
  HEKTS: "Hektaş",
  ISCTR: "İş Bankası",
  KCHOL: "Koç Holding",
  KOZAA: "Koza Madencilik",
  KOZAL: "Koza Altın",
  KRDMD: "Kardemir",
  MGROS: "Migros",
  ODAS: "Odaş Elektrik",
  OYAKC: "Oyak Çimento",
  PETKM: "Petkim",
  PGSUS: "Pegasus",
  SAHOL: "Sabancı Holding",
  SASA: "Sasa Polyester",
  SISE: "Şişe Cam",
  SOKM: "Şok Marketler",
  TAVHL: "TAV Havalimanları",
  TCELL: "Turkcell",
  THYAO: "Türk Hava Yolları",
  TOASO: "Tofaş",
  TSKB: "Türkiye Sınai Kalkınma Bankası",
  TTKOM: "Türk Telekom",
  TUPRS: "Tüpraş",
  ULKER: "Ülker",
  VAKBN: "Vakıfbank",
  VESTL: "Vestel",
  YKBNK: "Yapı Kredi",
  ZOREN: "Zorlu Enerji",
  XU100: "BIST 100 Endeksi",
};

export function companyName(ticker: string): string {
  if (!ticker) return "";
  const up = ticker.toUpperCase();
  return COMPANY_NAMES[up] ?? up;
}
