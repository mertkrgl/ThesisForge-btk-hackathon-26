# Riskler ve Tasarım Kararları

> Bilinen risk tablosu + finalize edilmiş tasarım kararlarının özet matrisi. **"X'i niye böyle yaptık, çökerse ne olur"** sorularının tek truth file'ı.
>
> İlgili: [`data.md`](data.md) §11 (veri katmanı riskleri) · [`flows.md`](flows.md) §6 (kill-switch) · [`sprint.md`](sprint.md) §4 (risk önceliği)

---

## 1. Risk Tablosu

| # | Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|---|
| 1 | KAP RSS kırılır | Orta | Düşük | **MKK API primary** (resmi REST), RSS fallback, 48 saat fixture snapshot |
| 2 | yfinance Yahoo politika değişir | Düşük | Yüksek | isyatirim secondary, TwelveData free tier 3. fallback, fixture |
| 3 | Gemini rate limit (429) | Orta | Yüksek | Exponential backoff, Flash öncelikli, cache agresif, kill-switch |
| 4 | Citation validator sonsuz loop | Çözüldü | — | **1-retry + `[KAYNAKSIZ]` soft pass** (Karar #9) |
| 5 | Devil's Advocate prompt zayıf | Orta | Yüksek | 3-4 prompt version A/B test, Gün 4-5 |
| 6 | BIST kapalı demo (akşam/hafta sonu) | Düşük | Orta | Pre-warmed cache + kill-switch fixture |
| 7 | Strands A2A protocol olgun değil | Çözüldü | — | **Agent-as-Tool fallback** (Karar #7) |
| 8 | KAP scraping legal/ToS | Düşük | Yüksek (legal) | MKK API resmi → RSS-first → saygılı scrape (1 req/sn, robots.txt, belirgin User-Agent) |
| 9 | TA-Lib kurulum zorluğu (Linux) | Çözüldü | — | **pandas-ta** (Karar #10, saf Python) |
| 10 | Sunum sırasında pipeline çöker | Orta | Yüksek | **Demo kill-switch** ([`flows.md`](flows.md) §6) |
| 11 | WebSocket bağlantı kopar | Orta | Düşük | **Reconnect + REST polling degrade** ([`stack.md`](stack.md) §3) |
| 12 | Sentiment yanlış (Türkçe NLP) | Çözüldü | — | **Sentiment Worker v2'ye atıldı** (Karar #4) |
| 13 | Gemini API key Google tarafından askıya alınır | Düşük | Çok Yüksek | **Tek hesap + Tier 1 paid** (Karar #5), ToS uyumlu kullanım |
| 14 | MKK API Portal onayı 7 günden uzun sürer | Orta | Orta | KAP RSS primary'de kalır, MKK v1.1'e ertelenir (Gün 1 sabah başvur) |
| 15 | isyatirim/borsapy IP-ban | Düşük | Yüksek | ≤1 req/sn ortak rate, agresif cache, yfinance secondary |

**Risk öncelik (sprint için):** [`sprint.md`](sprint.md) §4.

---

## 2. Finalize Edilmiş Tasarım Kararları

> `archive/DECISIONS.md` (2026-05-10) tarihinde sabitlenen 15 karar — bu projede tartışılmadan uygulanır.

| # | Konu | Karar | Etki |
|---|---|---|---|
| 1 | Vector DB | **pgvector** (ChromaDB değil) | Tek DB, Supabase free tier |
| 2 | Gemini modelleri | Devil's + Synthesizer **Pro**, diğer 6 ajan **Flash** | Kalite/maliyet dengesi |
| 3 | Conservative Mode | Synthesizer prompt parametresi (`user_mode`) + UI toggle | [`agents.md`](agents.md) §5 |
| 4 | Twitter sentiment | **Sentiment Worker v2'ye** | Hackathon scope sığmıyor |
| 5 | Gemini API key | **Tek hesap + Tier 1 paid plan** | Çoklu key rotasyonu ToS riski |
| 6 | Tez üretim süresi | **40–60s realist** + pre-warmed cache | "23s" iddiası dürüstçe terk edildi |
| 7 | Strands A2A | **Agent-as-Tool fallback** (basit feedback loop) | A2A protocol olgun değil |
| 8 | Backtest Validator | **v2'ye**, sadece Memory Agent kalır | Time-leakage riski |
| 9 | Citation enforcement | **1 retry**, sonra `[KAYNAKSIZ]` soft flag | Sonsuz döngü kapalı |
| 10 | Teknik analiz lib | **pandas-ta** (TA-Lib değil) | Docker build basit, cross-platform |
| 11 | Sektör squad'ları | **5+1 squad** + `sector_map.yaml` | TUPRS gibi yanlış atamalar düzeltildi |
| 12 | KAP veri erişimi | **MKK API primary** (yeni, sonra eklendi) → KAP RSS fallback | Bkz. Risk #14 |
| 13 | HashTrade referansı | **Tamamen kaldırıldı** | Rakipler tablosu temiz |
| 14 | Sprint planı | **7 günlük sprint, 3 kişi** | [`sprint.md`](sprint.md) |
| 15 | Test stratejisi | **Tam paket** (unit + integration + smoke + CI) | [`testing.md`](testing.md) |

### 2.1 Mimari Kümülatif Etki

- **Toplam ajan: 10 → 8** (Sentiment ve Backtest v2'ye)
- **Paralel worker: 3 → 2** (Technical + Fundamental)
- **Vector store: 1** (pgvector)
- **Model çeşitliliği: 2** (Pro: 2 ajan, Flash: 6 ajan)
- **API key: 1** (Gemini Tier 1 paid)
- **TA lib: pandas-ta** (TA-Lib yok)
- **Sektör squad: 5+1**
- **Veri primary: TCMB EVDS + MKK API + isyatirim + yfinance** (yeni)

---

## 3. Açık Sorular (İmplementasyon Sırasında Çözülecek)

1. **MKK API'nin tam endpoint kataloğu** — başvuru onayı sonrası netleşecek. Detay: [`data.md`](data.md) §11.
2. **isyatirim financial statement format adaptörü** — Türkçe IFRS sütun adları için `compute_ratios()` mapper.
3. **Pre-warm hisse listesi son hali** — Demo Gün 7'de 10 hisse mi 5 hisse mi? Karar: [`demo.md`](demo.md) §2.
4. **Devil's Advocate prompt A/B versiyonları** — Gün 4-5'te 3-4 varyant test, en iyisi sabitlenir.
5. **Conservative mode UI yerleştirme** — header toggle mı, profile setting mi? Karar: Gün 6, C tarafından.

---

## 4. Risk Yanıt Hiyerarşisi

Bir şey ters gittiğinde sıralı tepki:

1. **Cache hit kontrol** → veri taze değilse stale ile devam (data quality flag düşük)
2. **Secondary provider'a düş** → primary fail durumunda
3. **Fixture'a düş** → ikisi de fail
4. **`DataUnavailable` → Synthesizer "veri eksik" notu** → confidence cap
5. **Kill-switch tetikle** → 90s timeout veya 3 ardışık tool fail
6. **Pre-baked tez göster** → kill-switch sonrası, "⚠️ Demo modu" rozeti

Bu hiyerarşi pipeline'da otomatik. Manuel müdahale gerekmez (demo operator manual override hariç).
