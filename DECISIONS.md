# ThesisForge — Tasarım Kararları

> Bu dosya, `Analiz.md` Bölüm 3'te tespit edilen 14 düzeltme maddesi için verilen nihai kararları içerir. Geliştirme sırasında referans alınacak tek kaynaktır; çakışan eski metinler bu dosyaya göre güncellenmelidir.
>
> **Karar tarihi:** 2026-05-10

---

## Karar Tablosu

| # | Konu | Karar | Etki |
|---|---|---|---|
| 1 | Vector DB | **pgvector** tek seçenek | ChromaDB referansları kaldırılacak |
| 2 | Gemini modelleri | Devil's Advocate + Synthesizer = **Gemini 2.5 Pro**, diğer tüm ajanlar = **Gemini 2.5 Flash** | "3 Flash / 3.1 Pro" referansları normalize edilecek |
| 3 | Conservative Mode | Synthesizer prompt parametresi (`user_mode`) + UI toggle | Yeni parametre, UI'da basit switch |
| 4 | Twitter sentiment | **Sentiment Worker tamamen v2 roadmap'e** | Agent 5 mimariden çıkar |
| 5 | Gemini API key | **Tek hesap + Gemini paid Tier 1** | Çoklu key rotasyonu kaldırıldı |
| 6 | Tez üretim süresi | **40–60s realist** + pre-warmed cache | "23s" iddiası kaldırılacak |
| 8 | Backtest Validator | **v2 roadmap'e**, sadece Memory Agent kalır | Agent 9 mimariden çıkar |
| 9 | Citation enforcement | **1 retry**, sonra geçersizleri `[KAYNAKSIZ]` flag ile göster | Sonsuz döngü riski yok |
| 10 | Teknik analiz lib | **pandas-ta** (TA-Lib değil) | Docker build basit, cross-platform |
| 11 | Sektör squad'ları | **5+1 squad** + `sector_map.yaml` | TUPRS gibi yanlış atamalar düzeltildi |
| 12 | KAP veri erişimi | **RSS-first**, saygılı scrape fallback | User-Agent belirgin, 1 req/sn |
| 13 | HashTrade referansı | **Tamamen kaldır** | Rakipler tablosundan, başka yerden de |
| 14 | 10-günlük timeline | **Gün-gün sprint tablosu** (aşağıda güncel hali) | MVP gün 6 sonu |
| 15 | Test stratejisi | **Tam paket**: unit + integration + smoke + CI | Coverage hedefi >%70 kritik path |

---

## 1. Vector DB — pgvector

- Embedding store olarak **sadece pgvector** kullanılacak.
- PostgreSQL üstünden tek connection ile hibrit RAG (ilişkisel + vector).
- Supabase'in built-in pgvector desteği deploy'u basitleştirir.
- ChromaDB sadece performans sorunu çıkarsa fallback olarak değerlendirilir (şimdilik scope'ta yok).

**Aksiyon:** §2.1 mimari diyagramından ChromaDB referansları çıkarılacak.

---

## 2. Gemini Model Normalizasyonu

| Ajan | Model |
|---|---|
| Macro Context | Gemini 2.5 Flash |
| Orchestrator | Gemini 2.5 Flash |
| Sector Router | Gemini 2.5 Flash |
| Technical Analyst | Gemini 2.5 Flash |
| Fundamental Analyst | Gemini 2.5 Flash |
| **Devil's Advocate** | **Gemini 2.5 Pro** |
| Memory Agent | Gemini 2.5 Flash |
| **Synthesizer** | **Gemini 2.5 Pro** |

- "Gemini 3 Flash" / "3.1 Pro" referansları kaldırılacak (Ocak 2026 itibarıyla yok).
- Yeni model çıkarsa tek noktadan değiştirilebilir bir config tutulabilir (over-engineering değilse).

---

## 3. Conservative Mode

**Tetikleme:** Orchestrator user profilinden `user_mode` flag'ini Synthesizer'a geçer.

```
user_mode: "default" | "conservative"
```

**Conservative mode davranışı:**
1. Bear case başa alınır (default'ta bull başta).
2. Güven skoru üst sınırı **70**'e çekilir (yüksek güvenle "AL" denmez).
3. Temettü güvenliği ve volatilite başlıkları öne çıkar.
4. "Bu hisse muhafazakar profil için uygun mu?" özet cümlesi eklenir.

**UI:** Sağ üstte basit toggle (veya kullanıcı profil ayarı). Persona 3 (Ali Bey) default'ta conservative.

---

## 4. Sentiment Worker — v2 Roadmap

- **Agent 5 (Sentiment & News Worker) MVP'den çıkarıldı.**
- Twitter API maliyetli ($100+/ay), alternatif kaynaklar (Reddit/Ekşi/Telegram) parser yazımı için ek 1 gün gerektiriyor — hackathon scope'una sığmıyor.
- News context için **Macro Context Agent**'ın haber özeti yeterli görüldü.
- v2'de eklenecek: Reddit (r/borsaistanbul) + Ekşi Sözlük + Telegram public kanallar.

**Mimari etki:** Paralel worker sayısı 3 → **2** (Technical + Fundamental). Komite metaforu hala geçerli (8 ajan, eskiden 10).

---

## 5. Gemini API Key

- **Tek Google hesabı + tek API key + Tier 1 paid plan.**
- Tahmini hackathon maliyeti: **$10–20**.
- Çoklu key rotasyonu **kaldırıldı** (ToS riski).
- Ek önlemler:
  - Macro Context için 15 dakikalık cache.
  - yfinance / KAP cache agresif (24h TTL).
  - Pre-warmed cache demo hisseleri için (gün 9).

---

## 6. Tez Üretim Süresi

- **Resmi beklenti:** 40–60 saniye (tam tez).
- "23 saniye" iddiası dokümantasyondan kaldırılacak.
- Demo'da 5–10 popüler BIST hissesi için **pre-warmed cache** hazırlanacak (gün 9 sprint'i).
- UI'da streaming + "thinking" durumları detaylı gösterilecek (perceived latency düşürür).
- Worker max tool call limiti: **5**.

---

## 8. Backtest Validator — v2 Roadmap

- **Agent 9 (Backtest Validator) MVP'den çıkarıldı.**
- "Geçmişe gidip simulate" özelliği etkileyici ama hackathon'da Memory Agent zaten ground truth tracking sağlıyor — judge için yeterli.
- v2'de eklenecek: `as_of_date` parametresi tüm pipeline'a inject edilebilir hale getirilecek.

**Mimari etki:** Toplam ajan sayısı: **8** (Macro, Orchestrator, Router, Technical, Fundamental, Devil's, Memory, Synthesizer).

---

## 9. Citation Enforcement Politikası

**Soft enforcement, max 1 retry:**

1. **İlk validation hatası:** Synthesizer'a `"şu kaynaklar geçersiz, düzelt"` feedback ile **1 kez** retry.
2. **İkinci hata:** Geçersiz citation'ları `[KAYNAKSIZ]` etiketi ile işaretle, tezi öyle göster.
3. Geçersiz citation paternleri loglanır, prompt iyileştirme için kullanılır.

**Sayısal sanity check:** Ayrı katman; fail olursa sadece flag, regenerate yok.

**Avantaj:** Sonsuz döngü riski yok, deterministik süre, kullanıcıya şeffaflık.

---

## 10. Teknik Analiz Kütüphanesi

- **`pandas-ta`** kullanılacak.
- `pip install pandas-ta` — saf Python, cross-platform sorunsuz.
- 130+ indikatör hazır: RSI, MACD, Bollinger, ATR, ADX, Stochastic, vs.
- Pattern recognition için manuel implementasyon (gerekirse).
- TA-Lib referansları kaldırılacak.

---

## 11. Sektör Squad'ları (5+1)

| Squad | Hisseler (örnek) |
|---|---|
| **Banking** | GARAN, AKBNK, ISCTR, YKBNK, HALKB, VAKBN |
| **Energy & Utilities** | TUPRS, AKSEN, AKSA, ZOREN, ENJSA, AYGAZ |
| **Defense & Industrial** | ASELS, OTKAR, EREGL, KCHOL, KOZAL, KARSN |
| **Retail & Consumer** | BIMAS, MGROS, SOKM, ULKER, CCOLA, ARCLK |
| **Real Estate / Holding** | EKGYO, ISGYO, SAHOL, AGHOL, DOHOL |
| **Generic** | (BIST 50 dışı veya sınıflandırılamayan) |

**Aksiyon:** `sector_map.yaml` dosyası BIST 50'yi kapsayacak şekilde hazırlanacak. Her squad için Fundamental Worker prompt'u sektöre özel metrikleri sorgular (Banking → NIM/CAR, Energy → brent korelasyonu/refining margin, Defense → backlog/R&D, vs.).

---

## 12. KAP Veri Erişimi

**RSS-first stratejisi:**

1. Birincil kaynak: KAP RSS feed'leri (`kap.org.tr/tr/RssAjax`).
2. Detaylı bildirim için **saygılı scrape**:
   - User-Agent belirgin (proje adı + email).
   - Rate: max **1 req/sn**.
   - `robots.txt` saygılı.
3. Risk tablosuna **"KAP scraping legal status"** maddesi eklenecek.
4. Ürünleştirme aşamasında: KAP resmi veri lisansı veya 3rd party (Foreks/Matriks) bütçelenecek.

---

## 13. HashTrade Referansı

- §1.7 rakipler tablosundan **tamamen kaldırılacak**.
- Resmi raporda hiçbir yerde geçmeyecek.
- Ekibin önceki tecrübesi ayrı bir bağlamda (CV / başvuru formu) belirtilebilir, proje raporunda değil.

---

## 14. 10-Günlük Sprint Planı (Güncel)

| Gün | Hedef | Çıktı |
|---|---|---|
| 1 | Repo, Docker compose, FastAPI iskeleti, Gemini bağlantı testi (paid tier kurulumu) | "Hello world" agent çalışıyor |
| 2 | yfinance + KAP RSS reader + Macro Context Agent | Tek tool, JSON çıktı |
| 3 | Sector Router + `sector_map.yaml` (5+1 squad) + Technical Worker (pandas-ta) | Bir hisse için teknik analiz çıktı |
| 4 | Fundamental Worker (squad-specific metrikler) | 2 worker paralel çalışıyor |
| 5 | Devil's Advocate (basit, A2A'sız) + Synthesizer (citation'lı) | İlk tam tez Markdown |
| 6 | Citation validator (1-retry policy) + Memory Agent (write only) + pgvector setup | **MVP: tezler DB'ye yazılıyor** |
| 7 | Frontend: Watchlist + Chat + Thesis Viewer | UI canlı |
| 8 | WebSocket stream + Memory similarity search + Conservative mode toggle | Geçmiş tezler + persona modu |
| 9 | Demo polish + Pre-warmed cache (5-10 hisse) + Test paketi | Demo akıcı, CI yeşil |
| 10 | Sunum hazırlığı, video kayıt, fallback senaryolar | Submission |

**MVP feature listesi (gün 6 sonu):**
1. Tek hisse için bull/bear/catalysts tezi.
2. Citation-grounded (1-retry, `[KAYNAKSIZ]` flag).
3. Memory Agent yazıyor.

**Nice-to-have (gün 7+):**
- Memory similarity search (retrieve)
- Conservative mode toggle
- Pre-warmed cache
- WebSocket streaming

**v2 Roadmap (hackathon scope dışı):**
- Sentiment Worker (Reddit/Ekşi/Telegram)
- Backtest Validator (as-of-date simulate)
- A2A protocol
- Multi-user watchlist
- B2B white-label

---

## 15. Test Stratejisi (Tam Paket)

**Unit testler (öncelik):**
- `validate_citations()` — bilerek bozuk citation'lı tez ile test.
- `sector_router` — BIST 50 hissesi için doğru squad mı dönüyor.
- `compute_ratios()` — bilinen finansal tabloyla karşılaştır.

**Integration testler:**
- Bir hisse için end-to-end pipeline (mock LLM ile).
- Memory similarity — 3 fake tez insert et, similarity sorgusu beklenen sırayı versin.

**Smoke testler:**
- 5 popüler BIST hissesi için tam pipeline (gerçek LLM, gece cron).

**CI:** GitHub Actions
- PR'da: unit + integration
- Nightly: smoke

**Coverage hedefi:** Kritik path'lerde **>%70**.

---

## Mimari Etki Özeti

Verilen kararların kümülatif mimari etkisi:

- **Toplam ajan: 10 → 8** (Sentiment ve Backtest v2'ye)
- **Paralel worker: 3 → 2** (Technical + Fundamental)
- **Vector store: 1** (pgvector)
- **Model çeşitliliği: 2** (2.5 Pro: 2 ajan, 2.5 Flash: 6 ajan)
- **API key: 1** (paid tier)
- **TA lib: pandas-ta** (TA-Lib yok)
- **Sektör squad: 3 → 5+1**

Bu liste `Analiz.md` Bölüm 2'deki mimari diyagramları ve §2.6 sequence diagram'ı güncellenirken referans alınmalıdır.
