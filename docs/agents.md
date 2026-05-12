# Ajanlar, Squad'lar ve Citation Mimarisi

> 8 ajanın tam kataloğu, sektör squad sistemi, citation-grounded 4 katmanlı halüsinasyon savunması, conservative mode davranışı ve güven skoru formülü. **"Hangi ajan ne yapar, hangi tool'u çağırır"** sorularının tek truth file'ı.
>
> İlgili: [`architecture.md`](architecture.md) (orkestrasyon modeli) · [`data.md`](data.md) (tool kaynak chain) · [`flows.md`](flows.md) (sequence)

---

## 1. Ajan Kataloğu (8 Ajan)

| # | Ajan | Tip | Model | Rol |
|---|---|---|---|---|
| 1 | Macro Context | Background (cached) | Gemini 2.5 Flash | TÜFE, USD/TRY, CDS, BIST100 makro paragraf (15dk cache) |
| 2 | Orchestrator | Coordinator | Gemini 2.5 Flash | Routing kararları, paralel dispatch |
| 3 | Sector Router | Classifier | Gemini 2.5 Flash | Ticker → squad (`sector_map.yaml` lookup) |
| 4 | Technical Worker | Worker (parallel) | Gemini 2.5 Flash | pandas-ta indikatörleri (RSI, MACD, Bollinger, ATR), max 5 tool call |
| 5 | Fundamental Worker | Worker (parallel) | Gemini 2.5 Flash | Squad-spesifik finansal metrikler, KAP filings, peer compare |
| 6 | **Devil's Advocate** | Critic | **Gemini 2.5 Pro** | Worker output'una bear-side karşı argümanlar |
| 7 | **Synthesizer** | Composer | **Gemini 2.5 Pro** | Streaming Markdown tez (bull/bear/catalysts/risks/confidence) |
| 8 | Memory Agent | Stateful + Tool | text-embedding-3-large + Flash | Yazma/okuma, pgvector similarity |

**Model dağılımı:** Pro x2 (kalite kritik), Flash x6 (maliyet/hız). Tek Google hesabı + **Tier 1 paid plan**.

### 1.1 v2 Roadmap — Hackathon'a Dahil Olmayan Ajanlar

**Sentiment Worker (3. paralel worker)** — v2. Gerekçe: Twitter/X API maliyeti aylık $100+, Türkçe sentiment doğruluğu zayıf, hackathon risk/getiri düşük. v2: Reddit `r/borsaistanbul` + Ekşi Sözlük + Telegram. Detay: [`roadmap.md`](roadmap.md).

**Backtest Validator (9. ajan)** — v2. Gerekçe: "As-of date" pipeline tüm tool'larda tarih kilidi gerektirir, time-leakage riski yüksek, hackathon süresinde stabil yapılamaz. Demo'da pre-computed 3 hisse statik JSON gösterilebilir.

---

## 2. Ajan Detayları

### 2.1 Macro Context (Ajan 1)

- **Tools:** `get_tcmb_indicators()`, `get_bist_index_state()`, `get_global_signals()`, `get_recent_macro_news()`
- **Kaynak chain:** [`data.md`](data.md) — TCMB EVDS → TCMB enflasyon endpoint → fixture
- **Çıktı:** 1 paragraf makro özet, her cümle `[kaynak: tool_adı]`
- **Cache:** Redis `macro:context` TTL 15dk

### 2.2 Orchestrator (Ajan 2)

- **Sorumluluklar:** Intent parse, ticker validate, squad sorgula, paralel dispatch (`asyncio.gather`), critique tetikle, memory ara, synthesize çağır, DB'ye yaz
- **Tools:** `validate_ticker()`, `dispatch_workers()`, `get_macro_context()`, `save_thesis()`
- **Kritik kural:** Doğrudan veri kaynağına gitmez, sadece diğer ajanları orchestrate eder.

### 2.3 Sector Router (Ajan 3)

- **Primary:** `sector_map.yaml` lookup (BIST 50 statik mapping)
- **Fallback:** LLM ("hangi sektör?") — sınıflandırılamayan hisselerde
- **Tools:** `lookup_sector()`, `select_squad()`
- **Squad sistemi:** §3'e bak.

### 2.4 Technical Worker (Ajan 4)

- **Tools (sıralı):**
  1. `get_ohlcv(ticker, period="90d")` — yfinance primary, isyatirim secondary
  2. `calculate_indicators()` — pandas-ta (RSI, MACD, Bollinger, ATR)
  3. `detect_patterns()` — head-shoulders, double-top vb.
  4. `find_support_resistance()`
  5. `relative_strength()`
- **Max tool call:** 5 (Flash bütçesi)
- **Çıktı şeması (Pydantic):**
  ```python
  class TechnicalAnalysis(BaseModel):
      trend_short: Literal["bullish", "bearish", "neutral"]
      trend_long: Literal["bullish", "bearish", "neutral"]
      key_levels: dict  # support/resistance
      momentum_score: int  # 0-100
      patterns_detected: list[str]
      notable_observations: list[Observation]  # her biri call_id'ye bağlı
      citations: list[Citation]
  ```
- **Kural:** Her observation `tool_call_id` ile bağlı, spekülasyon yok.

### 2.5 Fundamental Worker (Ajan 5)

- **Tools (sıralı):**
  1. `fetch_kap_filings()` — MKK API primary, KAP RSS fallback
  2. `get_financial_statements()` — isyatirim primary, yfinance secondary
  3. `compute_ratios()` — lokal hesap (Türkçe IFRS sütun adı adaptörü)
  4. `get_sector_peers()` — borsapy scanner
  5. `compare_to_peers()`
  6. `get_dividend_history()`
- **Squad-spesifik system prompt:**
  - Banking → NIM, NPL, SYR, CASA
  - Energy → refining margin, Brent korelasyonu, kapasite
  - Defense → backlog, R&D harcama, USD revenue %, sözleşmeler
  - Retail → LFL büyüme, mağaza sayısı, sepet, SSS
  - RealEstate → NAV iskonto, doluluk, portföy değeri
- Kaynak detayı: [`data.md`](data.md) §3.1.

### 2.6 Devil's Advocate (Ajan 6) — Pro

- **Rol:** 2 worker çıktısını **bilinçli olarak** sorgular. ThesisForge'un ayrıştırıcı özelliği.
- **Tools:** `query_workers(question, target)` (basit feedback loop), `find_disconfirming_evidence()`, `base_rate_check()`
- **Çıktı şeması (Pydantic):**
  ```python
  class Critique(BaseModel):
      technical_pushback: list[str]
      fundamental_pushback: list[str]
      cross_cutting_risks: list[str]
      base_rate_warnings: list[str]
      overall_critique_strength: int  # 0-100
  ```
- **Prompt felsefesi:** *"Sen kıdemli risk yöneticisisin. Hisseyi kötülemiyorsun, tezi GÜÇLENDİRMEK için zayıflıkları açığa çıkarıyorsun."*

### 2.7 Synthesizer (Ajan 7) — Pro

- **Girdi:** Macro context + 2 Worker raporu + Devil critique + Memory similarity hits + `user_mode` flag
- **Çıktı Markdown şablonu:**
  ```
  TL;DR
  ↓
  Bull Case        (conservative mode → Bear başa)
  ↓
  Bear Case
  ↓
  Anahtar Katalizörler 📅
  ↓
  Tarihsel Bağlam (Memory)
  ↓
  Risk Uyarıları
  ↓
  Güven Skoru (explainable breakdown)
  ↓
  Disclaimer
  ```
- **Kesin kurallar:**
  1. Her claim sonunda `[kaynak: <call_id>]`
  2. Bull/Bear dengeli (default mode)
  3. Tahmin yok, "varsayımlar tutarsa" formatı
  4. Sayı uydurmak yasak
  5. Disclaimer zorunlu
- **Streaming:** Token-by-token WebSocket push.

### 2.8 Memory Agent (Ajan 8)

- **Write (Synthesizer biten tezden sonra):** Tezi text-embedding-3-large ile embed → `theses` tablosu + pgvector index
- **Read (Synthesizer öncesi):** Yeni sorgu embed → top_k=3 benzerlik (`ticker = current OR sector_match`) → "6 ay önce ASELS AL +%18" inject
- **Gece cron (02:00 UTC):** `outcome = 'pending'` ve `thesis_date <= now - 7 days` → yfinance'ten fiyat çek → `actual_return` hesapla → outcome güncelle
- Detay: [`flows.md`](flows.md) §4.

---

## 3. Sektör Squad Sistemi (5+1)

| Squad | Örnek Hisseler | Anahtar Metrikler |
|---|---|---|
| **Banking** | GARAN, AKBNK, ISCTR, YKBNK, HALKB, VAKBN | NIM, CAR, NPL, CASA oranı, kredi/mevduat, SYR |
| **Energy** | TUPRS, AKSEN, AKSA, ZOREN, ENJSA, AYGAZ | Refining margin, Brent korelasyonu, kapasite, EPDK |
| **Defense** | ASELS, OTKAR, EREGL, KCHOL, KOZAL, KARSN | Backlog, R&D harcama, USD revenue %, sözleşmeler |
| **Retail** | BIMAS, MGROS, SOKM, ULKER, CCOLA, ARCLK | LFL büyüme, mağaza sayısı, sepet büyüklüğü, SSS |
| **RealEstate** | EKGYO, ISGYO, SAHOL, AGHOL, DOHOL | NAV iskonto, portföy değeri, doluluk |
| **Generic** | BIST 50 dışı / sınıflandırılamayan | P/E, P/B, ROE, EBITDA |

**Mapping kaynak:** `backend/config/sector_map.yaml` (BIST 50 statik) + LLM fallback sınıflandırılamayan hisselerde.

**Squad → Fundamental Worker'ı nasıl etkiler:** Sistem prompt'unda squad-spesifik metrikler listelenir. Tool çağrı sırası değişmez, sadece **odak değişir**. Örnek: Banking squad'da `compute_ratios()` NIM/NPL hesaplar; Generic squad'da P/E hesaplar.

---

## 4. Citation-Grounded Mimari (4 Katmanlı Halüsinasyon Savunması)

1. **Tool Provenance Logging** — Her tool call `tool_call_logs` tablosuna yazılır: `{call_id, agent_id, tool_name, args, result, ts}`. UUID `call_id` unique. Şema: [`database.md`](database.md) §1.
2. **Structured Output Schemas** — Worker'lar free-form text değil, **Pydantic schema** döner. Her `Claim { text, citation_call_id, confidence }` formatında.
3. **Synthesizer Citation Enforcement (ID-bazlı)** — Synthesizer her `[kaynak: <call_id>]` etiketini tool log'a karşı doğrular. ID-bazlı match deterministik (regex değil).
4. **Numeric Sanity Check** — Tüm sayılar regex ile yakalanır, tool log'larda gerçekten var mı kontrol edilir.

**Citation policy:** **1 retry**, hala başarısız ise `[KAYNAKSIZ]` flag ile **soft pass**. Sonsuz döngü yok, deterministik. Akış: [`flows.md`](flows.md) §3.

**Soft flag UI:** `[KAYNAKSIZ]` etiketi turuncu rozetle gösterilir — kullanıcı **bilinçli olarak** doğrulanamayan iddiayı görür.

---

## 5. Conservative Mode

**Tetikleme:** Orchestrator user profilinden `user_mode: "default" | "conservative"` flag'ini Synthesizer'a geçirir. UI sağ üstte toggle. Persona Ali Bey ([`product.md`](product.md) §4.3) default conservative.

**Conservative davranışlar:**

1. **Bear case başa** (default'ta bull başta)
2. **Confidence üst sınırı = 70** (yüksek güvenle "AL" yok)
3. **Temettü güvenliği** başlıkları vurgulanır (Synthesizer prompt template'inde slot)
4. **Volatilite uyarısı** eklenir
5. **"Bu hisse muhafazakar profil için uygun mu?"** özet cümlesi sonda

Akış: [`flows.md`](flows.md) §5.

---

## 6. Güven Skoru Formülü

Synthesizer çıktısında **açıklanabilir breakdown:**

```
Confidence = 0.25 × Data Quality
           + 0.20 × Technical Score
           + 0.20 × Fundamental Score
           + 0.15 × News/Macro Alignment
           + 0.10 × Memory Base Rate
           + 0.10 × Devil's Advocate Inverse
```

| Bileşen | Hesap |
|---|---|
| Data Quality | Tool call başarı oranı + veri tazeliği (cache hit rate) |
| Technical / Fundamental Score | Worker'ın kendi confidence çıktısı (0-100) |
| News/Macro Alignment | Sentiment + makro uyum (haber pozitifse +, makro karşıt rüzgar ise −) |
| Memory Base Rate | Geçmiş benzer tezlerin `actual_return` ortalaması |
| Devil's Advocate Inverse | Critique strength düşükse +, yüksekse − |

**Conservative mode:** Toplam ≤70 ile cap'lenir (§5).

**UI:** recharts ile horizontal bar — her bileşenin katkısı renkli segment olarak.

---

## 7. Ajan-Veri Eşleştirme Hızlı Referans

Hangi ajanın hangi kaynak chain'i çağırdığı — tam tablo: [`data.md`](data.md) §3.

| Ajan | Veri domain'i | Primary kaynak |
|---|---|---|
| Macro Context | `macro` | TCMB EVDS |
| Technical Worker | `price`, indikatör (lokal) | yfinance + pandas-ta |
| Fundamental Worker | `kap`, `financials`, `analyst`, `peers` | MKK API + isyatirim + borsapy |
| Memory Agent | embedding + pgvector | OpenAI + lokal DB |
| Synthesizer (news context) | `news` | Mynet scrape |
