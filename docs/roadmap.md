# v2 Roadmap

> Hackathon scope dışı, post-hackathon (v2+) eklenecek özellikler. **"Şimdi yapmıyoruz ama yapacağız"** listesi.
>
> İlgili: [`agents.md`](agents.md) §1.1 (v2 ajanlar) · [`data.md`](data.md) §12 (veri katmanı v2)

---

## 1. Sentiment Worker (3. Paralel Worker)

**Niye v2:** Twitter/X API maliyeti aylık $100+, Türkçe sentiment doğruluğu zayıf. Hackathon scope için risk/getiri düşük.

**Plan:**
- Kaynaklar: Reddit `r/borsaistanbul`, `r/turkfinance`, Ekşi Sözlük başlık tracker, Telegram public kanallar
- Türkçe sentiment fine-tuning: XLM-RoBERTa + Türkçe finance corpus
- Pipeline'a 3. paralel worker olarak eklenir (Technical + Fundamental + Sentiment)
- Confidence formülünde [`agents.md`](agents.md) §6 "News/Macro Alignment" payı sentiment ile zenginleşir

---

## 2. Backtest Validator (9. Ajan)

**Niye v2:** "As-of date" pipeline'ı tüm tool'larda tarih kilidi gerektirir. Time-leakage savunması çok dikkat ister; hackathon süresinde stabil yapılamaz.

**Plan:**
- `as_of_date` parametresi tüm DataProvider'lara inject
- Pipeline'ı geçmiş tarih için çalıştır → outcome ile karşılaştır
- KAP filings tarih filtre, fiyat lookahead yasak
- Hackathon demo'sunda **pre-computed 3 hisse statik JSON** gösterilebilir (lite version)

---

## 3. True A2A Protocol (Strands Olgunlaştığında)

**Niye v2:** Strands A2A protocol şu an stabil değil. Hackathon'da **Agent-as-Tool fallback** ile basit feedback loop kuruyoruz ([`risks.md`](risks.md) Karar #7).

**Plan:**
- Devil's Advocate ↔ Workers **gerçek bidirectional dialogue**
- Örnek: "Pattern bozulduğunu söylüyorsun, son 12 ay base rate ne?" → Technical worker `base_rate_check` tool çağırır → yanıt döner → critique zenginleşir
- Pipeline süresine +5-10s ekler ama kalite ciddi artar

---

## 4. Multi-user + B2B White-Label

**Hedef:** Aracı kurum / kurumsal müşteri.

**Plan:**
- Tenant izolasyonu (`users.tenant_id`, RLS politikası)
- Aracı kurum branding (logo, renk, disclaimer customize)
- Toplu watchlist + sabah brifing PDF (junior PM persona — [`product.md`](product.md) §4.4)
- SSO (OIDC) entegrasyonu

---

## 5. Mobile (PWA → Native)

**Niye PWA önce:** Hackathon scope. Next.js zaten PWA-ready.

**Plan v2:**
- Push notification: watchlist tez güncellendi
- Offline tez okuma (IndexedDB cache)
- Native wrapper: Capacitor (tek codebase iOS+Android)

---

## 6. Premium Data Layer

**Niye v2:** Hackathon ücretsiz API'lerle yetiniyoruz ([`data.md`](data.md)). Production'da real-time tick lazım.

**Plan:**
- Foreks / Matriks lisansı (₺500-5000/ay)
- Real-time tick data → Technical Worker'a canlı OHLCV
- Analist tahmin agregasyonu (Refinitiv vb.)
- BIST VERDA API resmi lisanslı kaynak

---

## 7. Sosyal Özellikler

**Hedef:** Topluluk pulse + transparency.

**Plan:**
- Tezler için yorum + tartışma (Reddit-style threading)
- "Bu tezi takip ediyorum" + portföy bağlantısı (kullanıcı isterse)
- **Topluluk doğruluk skorboard** — public outcome stats (sistem ne kadar doğru bilmiş)

---

## 8. Veri Katmanı v2 Özellikleri

[`data.md`](data.md) §12'den derlenmiş:

- **TEFAS BindHistoryInfo** — 800+ Türk yatırım fonu, fon-bazlı tez
- **Bank API portals** (Yapı Kredi, Vakıfbank) — BIST endeks fiyatı, yfinance secondary alternatifi
- **Reddit/Ekşi/Telegram sentiment** — Sentiment Worker geldiğinde
- **Webhook tabanlı KAP invalidation** — yeni filing geldiğinde cache anında invalidate
- **CDN cache layer** — fixture'ları S3'e replicate

---

## 9. Diğer

- **Grafana + Tempo + Prometheus** (production observability) — [`testing.md`](testing.md) §4.4
- **A/B test framework** — Devil's Advocate prompt versionları, confidence formülü tuning
- **Watchlist için tek-tıkla tez yenileme** — haftalık batch run
- **Telegram bot UI** — chat input → tez output (mobile native alternatifi)
- **API olarak ThesisForge** — B2B müşterilere REST endpoint (`POST /api/v1/thesis`)

---

## Önceliklendirme (v2 İlk Sprint)

Eğer v2 başlarsa öncelik sırası:

1. **Memory similarity → confidence formülü** (zaten yarı yapıldı, kazancı yüksek)
2. **Backtest Validator** (pazarlama açısından güçlü)
3. **Sentiment Worker** (Türkçe NLP zor ama diferansiyatör)
4. **B2B white-label** (revenue path)
5. **Premium data layer** (B2B'siz anlamsız)
6. **Sosyal özellikler** (network effect uzun vade)

Her madde için ayrı sprint, ayrı doc dosyası açılır (`docs/v2/sentiment.md` vb.).
