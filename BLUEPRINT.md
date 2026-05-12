# ThesisForge — Nihai Proje Blueprint'i

> **Truth file.** Bu dosya projenin tek geçerli dokümantasyonudur. Eski planlama notları `archive/` klasöründedir ve **referans amaçlıdır**.
>
> Son güncelleme: 2026-05-12 · Sürüm: 1.0 · 7 gün / 3 kişi hackathon scope'u

---

## İçindekiler

- [A. Ürün](#a-ürün)
  - [A.1 Tek Cümleyle Ne Yapar](#a1-tek-cümleyle-ne-yapar)
  - [A.2 Çözülen Problem](#a2-çözülen-problem)
  - [A.3 Ne Olduğu / Ne Olmadığı](#a3-ne-olduğu--ne-olmadığı)
  - [A.4 Personalar](#a4-personalar)
  - [A.5 Değer Önerisi ve Regülasyon Konumlandırması](#a5-değer-önerisi-ve-regülasyon-konumlandırması)
  - [A.6 Rakip Konumlama](#a6-rakip-konumlama)
- [B. Mimari](#b-mimari)
  - [B.1 Üst Seviye Sistem Mimarisi](#b1-üst-seviye-sistem-mimarisi)
  - [B.2 Orkestrasyon Modeli (Strands)](#b2-orkestrasyon-modeli-strands)
  - [B.3 Ajan Kataloğu (8 Ajan)](#b3-ajan-kataloğu-8-ajan)
  - [B.4 Sektör Squad Sistemi (5+1)](#b4-sektör-squad-sistemi-51)
  - [B.5 Citation-Grounded Mimari](#b5-citation-grounded-mimari)
  - [B.6 Conservative Mode](#b6-conservative-mode)
  - [B.7 Güven Skoru Formülü](#b7-güven-skoru-formülü)
- [C. Akışlar](#c-akışlar)
  - [C.1 Uçtan Uca Sequence Diagram](#c1-uçtan-uca-sequence-diagram)
  - [C.2 Cache Stratejisi](#c2-cache-stratejisi)
  - [C.3 Citation Enforcement Akışı](#c3-citation-enforcement-akışı)
  - [C.4 Memory Read/Write + Gece Cron](#c4-memory-readwrite--gece-cron)
  - [C.5 Demo Kill-Switch Akışı](#c5-demo-kill-switch-akışı)
- [D. Veri Katmanı](#d-veri-katmanı)
  - [D.1 Kaynak Tablosu ve Erişim Garantileri](#d1-kaynak-tablosu-ve-erişim-garantileri)
  - [D.2 DataProvider Interface ve Fallback Zinciri](#d2-dataprovider-interface-ve-fallback-zinciri)
  - [D.3 TCMB EVDS API Kayıt Prosedürü](#d3-tcmb-evds-api-kayıt-prosedürü)
  - [D.3.2 MKK API Portal Kayıt Prosedürü](#d32-mkk-api-portal-kayıt-prosedürü-kap-resmi-rest-api)
  - [D.4 Maliyet Tahmini](#d4-maliyet-tahmini)

> **Not:** Veri katmanının tam ayrıntıları (kaynak kataloğu, modül-kaynak eşleştirme matrisi, fallback senaryoları, kayıt prosedürleri, lisans/atıf) ayrı bir dosyada: [**`VERI.md`**](VERI.md). BLUEPRINT.md D bölümü özet; çelişki halinde VERI.md geçerlidir.
- [E. Teknoloji Yığını](#e-teknoloji-yığını)
- [F. Persistence Şemaları](#f-persistence-şemaları)
- [G. Sprint Planı (7 Gün, 3 Kişi)](#g-sprint-planı-7-gün-3-kişi)
- [H. Test ve Gözlemlenebilirlik](#h-test-ve-gözlemlenebilirlik)
- [I. Risk Tablosu](#i-risk-tablosu)
- [J. Demo Stratejisi](#j-demo-stratejisi)
- [K. v2 Roadmap](#k-v2-roadmap)

---

# A. ÜRÜN

## A.1 Tek Cümleyle Ne Yapar

> **ThesisForge:** *"Profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan AI sistemi."*

ThesisForge bir "borsa botu" ya da tahmin makinesi değildir; **karar destek sistemidir**. Kullanıcının kararı yerine geçmez, kararı daha iyi vermesini sağlar. Sistemin farkı çıktının kendisinden çok **çıktıyı üreten süreçtir**: birden fazla "analist ajan" aynı hisseye farklı açılardan bakar, biri devil's advocate olarak tezi sorgular, sentezleyici son kararı bull/bear/catalyst yapısında derler.

## A.2 Çözülen Problem

**Türkiye retail yatırımcı tablosu:**

- 6 milyondan fazla bireysel yatırım hesabı
- Çoğu son 4-5 yılda açıldı (enflasyondan kaçış + döviz kontrolleri)
- Sonuç: piyasaya yeni gelmiş, deneyimsiz, ama parası olan büyük bir kitle

Bu kitle bir hisseyi araştırırken aşağıdakilerden birini yapar — ve hepsinin ciddi açıkları vardır:

| Yöntem | Sorun |
|---|---|
| Sosyal medya / Telegram grupları | Pump-dump çetelerinin yemi olur, manipülasyona açık |
| YouTube "borsa hocaları" | Çoğu sponsorlu, çıkar çatışması, gecikmiş bilgi |
| Tek bir aracı kurum raporu | Tek perspektif, kurumun pozisyonuna göre eğimli |
| Kendi araştırması | KAP'ı okumayı bilmiyor, finansal tabloyu anlayamıyor, haber + sentiment + teknik birleştiremiyor |
| Robo-advisor | Türkiye'de yok denecek kadar az; varsa portföy önerir, **tez üretmez** |

**Asıl sorun:** Bir hisse hakkında **çok-perspektifli, dengeli, kaynaklı** bir görüş üretmek profesyonel yatırım komitelerinin işidir — birden çok analist farklı açılardan bakar, bir risk yöneticisi karşı çıkar, bir başkan sentez yapar. Bu süreç retail yatırımcıya hiçbir ürün tarafından sunulmuyor.

**ThesisForge'un savunulabilir farkı:** Çıktıyı değil, **çıktıyı üreten komite sürecini** modeller.

## A.3 Ne Olduğu / Ne Olmadığı

| ThesisForge **DEĞİLDİR** | ThesisForge **AYNEN BUDUR** |
|---|---|
| Bot — kullanıcı yerine işlem yapmaz | **Karar destek sistemi** — kararı kullanıcı verir |
| Tahmin makinesi ("ASELS yarın 75 TL olur") | **Tez üretici** ("Şu varsayımlar tutarsa yön yukarı") |
| Garanti vaad eden sistem | Belirsizliği **explicit hesaplayan**, güven aralığı veren |
| Tek doğru cevap üretir | **Bull case + Bear case + Anahtar katalizörler** üretir |
| Black box | **Her cümlenin kaynağı görünür** (cite-able) |
| HFT / intraday tahmin aracı | **Swing-trade ve uzun vadeli yatırım** aracı |
| Yatırım danışmanlığı (SPK lisansı gerektirir) | **Bilgi sunumu ve eğitim aracı** (lisans dışı) |

## A.4 Personalar

### Mehmet — 34, Mühendis — *"Hobby Investor"*
- BİST'te 6 yıl, 7 hisselik portföy. Maaşının %20'sini yatırıma ayırıyor.
- Haftada 1–2 saati araştırmaya ayırabiliyor.
- **Sorun:** Bilgi fazla, sentez zor. *"Hangisi gerçekten önemli?"*
- **Değer:** Watchlist'inin tezini haftalık 10 dakikada güncelleyip karar moduna geçer.

### Zeynep — 27, Finans Öğrencisi / Junior Analyst — *"Aspiring Pro"*
- CFA Level 1 hazırlanıyor. KAP'ı okumayı biliyor ama zaman sıkıntısı.
- **Sorun:** Verim. Profesyonel iş akışını taklit etmek istiyor.
- **Değer:** Kendi tezini yazmadan önce "AI komite ne demiş" diye bakar, kör noktalarını yakalar.

### Ali Bey — 56, Emekli Devlet Memuru — *"Conservative Saver"*
- Emeklilik birikimini değerlendirmek istiyor. Temettü hisselerine ilgili (BIMAS, AKBNK, EREGL).
- Teknik analizi anlamıyor ve istemiyor — temel hikaye yeterli.
- **Sorun:** Yanlış hisseye girip sermayeyi yakma korkusu.
- **Değer:** **Conservative mode** — bear case ağırlıklı, temettü güvenliği vurgulanır.

### Sekonder — Junior PM / Analyst (Kurumsal)
Hackathon hedef kitlesi değil, B2B genişlemesi için kritik. Aracı kurumlarda junior analistler ThesisForge'u brifing aracı olarak kullanabilir (sabah toplantısı özeti).

## A.5 Değer Önerisi ve Regülasyon Konumlandırması

ThesisForge **bilgi sunumu ve eğitim aracı** konumlanır, **yatırım danışmanlığı değildir** (SPK lisansı dışı). Bu konumlandırma:

1. **Regülasyon riskini azaltır.** SPK'nın "yatırım danışmanlığı" tanımına girmemek için "tez üretici" olarak konumlanır, "öneri yapıcı" olarak değil.
2. **Judge psikolojisi açısından akıllıdır.** "AI insan yerine karar verir" korkusu sunum ilk 60 saniyesinde söndürülür.
3. **Her tezde zorunlu disclaimer** bulunur: *"Bu içerik bilgi amaçlıdır, yatırım tavsiyesi değildir. Yatırım kararları için lisanslı bir danışmana başvurun."*

## A.6 Rakip Konumlama

| Rakip Tipi | Ne Yapıyor | ThesisForge Farkı |
|---|---|---|
| Sosyal medya / Telegram | Manipülasyona açık tek-sesli yorumlar | Çok-perspektifli + kaynaklı |
| YouTube borsa hocaları | Sponsorlu, gecikmiş | Real-time, çıkar çatışmasız |
| Aracı kurum raporları | Tek perspektif, kurumsal eğimli | Bağımsız komite, devil's advocate |
| Robo-advisor (yurt dışı) | Portföy önerir, **tez üretmez** | Tez üretici, eğitici |
| Generic AI chatbot (ChatGPT vb.) | Halüsinasyona açık, kaynaksız | **Citation-grounded** + Türkiye-spesifik veri |

**Diferansiyatör 3'lü kombinasyon:** (1) multi-agent komite süreci + (2) her sayının kaynağına bağlı citation + (3) geçmiş tezleri hatırlayan memory ajanı. Bu kombinasyon piyasada yok.

---

# B. MİMARİ

## B.1 Üst Seviye Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                        │
│   Next.js 15 (PWA) — Watchlist | Chat | Thesis Viewer          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ WebSocket (agent thinking stream)
                       │ REST (CRUD, history, degrade fallback)
┌──────────────────────┴──────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
│         FastAPI + Strands Orchestrator                          │
└──┬────────────────────────────────────┬─────────────────────────┘
   │                                    │
┌──┴──────────────────┐        ┌───────┴──────────────┐
│   AGENT LAYER       │        │ DATA & TOOL LAYER    │
│  (Strands)          │◄─tools─┤                      │
│                     │        │ • DataProvider IF    │
│ • Orchestrator      │        │   ├── primary        │
│ • Macro Context     │        │   ├── secondary      │
│ • Sector Router     │        │   └── fixture        │
│ • Technical Worker  │        │ • KAP RSS + scrape   │
│ • Fundamental W.    │        │ • yfinance           │
│ • Devil's Advocate  │        │ • pandas-ta          │
│ • Synthesizer       │        │ • TCMB EVDS          │
│ • Memory Agent      │        │ • News scraper       │
└──┬───────────────────┘       └──────────────────────┘
   │
┌──┴─────────────────────────────────────────────────────┐
│             PERSISTENCE LAYER                          │
│ PostgreSQL + pgvector (users, watchlist, theses,       │
│                       tool_call_logs, citations,       │
│                       thesis_embeddings)               │
│ Redis (cache + agent state + WebSocket pub/sub)        │
│ Fixture Store (disk: fixtures/<ticker>/<date>.json)    │
└────────────────────────────────────────────────────────┘
```

## B.2 Orkestrasyon Modeli (Strands)

| Bölüm | Pattern | Sebep |
|---|---|---|
| Sector Router → Worker seçimi | Graph | Koşullu dallanma (sektöre göre squad) |
| Technical + Fundamental | Agent-as-Tool (Parallel) | Bağımsız çalışırlar |
| Devil's Advocate → Workers | Tool fallback (basit feedback loop) | A2A protocol olgun değil → Agent-as-Tool ile feedback loop |
| Synthesizer | Tek ajan + Structured Output | Deterministik markdown çıktı |
| Memory | Tool call | Stateless DB sorgusu |

**Execution model:** Orchestrator → 3-bacak paralel (Sector Router + Macro Context + Memory similarity) → 2 Worker paralel (Technical + Fundamental) → Devil's Advocate (sequential, worker output ister) → Synthesizer (sequential, tüm input) → Citation Validator (1-retry) → DB persist + Memory write.

**Toplam beklenen süre:** **40–60 saniye** (realistic). Pre-warmed cache ile <8 saniye.

## B.3 Ajan Kataloğu (8 Ajan)

| # | Ajan | Tip | Model | Rol |
|---|---|---|---|---|
| 1 | Macro Context | Background (cached) | Gemini 2.5 Flash | TÜFE, USD/TRY, CDS, BIST100 makro paragraf (15dk cache) |
| 2 | Orchestrator | Coordinator | Gemini 2.5 Flash | Routing kararları, paralel dispatch |
| 3 | Sector Router | Classifier | Gemini 2.5 Flash | Ticker → squad (sector_map.yaml lookup) |
| 4 | Technical Worker | Worker (parallel) | Gemini 2.5 Flash | pandas-ta indikatörleri (RSI, MACD, Bollinger, ATR), max 5 tool call |
| 5 | Fundamental Worker | Worker (parallel) | Gemini 2.5 Flash | Squad-spesifik finansal metrikler, KAP filings, peer compare |
| 6 | **Devil's Advocate** | Critic | **Gemini 2.5 Pro** | Worker output'una bear-side karşı argümanlar |
| 7 | **Synthesizer** | Composer | **Gemini 2.5 Pro** | Streaming Markdown tez (bull/bear/catalysts/risks/confidence) |
| 8 | Memory Agent | Stateful + Tool | text-embedding-3-large + Flash | Yazma/okuma, pgvector similarity |

**Model dağılımı:** Pro x2 (kalite kritik), Flash x6 (maliyet/hız). Tek Google hesabı + **Tier 1 paid plan**.

### B.3.1 Sentiment Worker — v2 Roadmap (DAHİL DEĞİL)

**Gerekçe:** Twitter/X API maliyeti aylık $100+, Türkçe sentiment doğruluğu zayıf, hackathon kapsamı için risk/getiri oranı düşük. v2'de Reddit (`r/borsaistanbul`) + Ekşi Sözlük + Telegram public kanalları ile yapılacak.

### B.3.2 Backtest Validator — v2 Roadmap (DAHİL DEĞİL)

**Gerekçe:** "As-of date" pipeline'ı tüm tool'larda tarih kilidi gerektirir; time-leakage riski yüksek; hackathon süresinde stabil yapılamaz. v2'de eklenir. Hackathon demo'sunda **pre-computed 3 hisse backtest sonucu** (statik JSON) opsiyonel gösterilebilir.

### B.3.3 Ajan Detayları

**Macro Context (Ajan 1)**
- Tools: `get_tcmb_indicators()`, `get_bist_index_state()`, `get_global_signals()`, `get_recent_macro_news()`
- Çıktı: 1 paragraf makro özet, her cümle [kaynak: tool_adı]
- Redis cache: `macro:context` TTL 15dk

**Orchestrator (Ajan 2)**
- Sorumluluklar: intent parse, ticker validate, squad sorgula, paralel dispatch (`asyncio.gather`), critique tetikle, memory ara, synthesize çağır, DB'ye yaz
- Tools: `validate_ticker()`, `dispatch_workers()`, `get_macro_context()`, `save_thesis()`

**Sector Router (Ajan 3)**
- `sector_map.yaml` lookup (BIST 50 hissesi mapping)
- Fallback: Generic squad
- Tools: `lookup_sector()`, `select_squad()`

**Technical Worker (Ajan 4)**
- Tools: `get_ohlcv(ticker, period="90d")` → `calculate_indicators()` (pandas-ta) → `detect_patterns()` → `find_support_resistance()` → `relative_strength()`
- Çıktı şeması (Pydantic): `TechnicalAnalysis { trend_short, trend_long, key_levels, momentum_score, patterns_detected, notable_observations, citations[] }`
- Kural: Her observation tool_call_id ile bağlı, spekülasyon yok

**Fundamental Worker (Ajan 5)**
- Tools: `fetch_kap_filings()` → `get_financial_statements()` → `compute_ratios()` → `get_sector_peers()` → `compare_to_peers()` → `get_dividend_history()`
- Squad-spesifik system prompt: Banking → NIM/NPL/SYR; Energy → refining margin/brent korelasyonu; Defense → backlog/R&D/USD revenue; Retail → LFL/SSS/sepet büyüklüğü; RealEstate → NAV iskonto/doluluk

**Devil's Advocate (Ajan 6)**
- Rol: 2 worker çıktısını **bilinçli olarak** sorgular. ThesisForge'un ayrıştırıcı özelliği.
- Tools: `query_workers(question, target)` (basit feedback loop), `find_disconfirming_evidence()`, `base_rate_check()`
- Çıktı: `Critique { technical_pushback, fundamental_pushback, cross_cutting_risks, base_rate_warnings, overall_critique_strength }`
- Prompt felsefesi: *"Sen kıdemli risk yöneticisisin. Hisseyi kötülemiyorsun, tezi GÜÇLENDİRMEK için zayıflıkları açığa çıkarıyorsun."*

**Synthesizer (Ajan 7)**
- Girdi: Macro context + 2 Worker raporu + Devil critique + Memory similarity hits
- Çıktı: Markdown şablon — TL;DR → Bull Case → Bear Case → Anahtar Katalizörler 📅 → Tarihsel Bağlam (Memory) → Risk Uyarıları → Güven Skoru (explainable breakdown) → Disclaimer
- Kesin kurallar: (1) Her claim sonunda `[kaynak: <call_id>]` (2) Bull/Bear dengeli (3) Tahmin yok, "varsayımlar tutarsa" formatı (4) Sayı uydurmak yasak (5) Disclaimer zorunlu
- Streaming: token-by-token WebSocket push

**Memory Agent (Ajan 8)**
- Write: Synthesizer biten tezi text-embedding-3-large ile embed → `theses` tablosu + pgvector index
- Read (Synthesizer öncesi): Yeni sorgu embed → top_k=3 benzerlik → "6 ay önce ASELS AL +%18" inject
- Gece cron (02:00 UTC): yfinance'ten geçmiş tezlerin actual_return hesapla, `ground_truth_return` update

## B.4 Sektör Squad Sistemi (5+1)

| Squad | Örnek Hisseler | Anahtar Metrikler |
|---|---|---|
| **Banking** | GARAN, AKBNK, ISCTR, YKBNK, HALKB, VAKBN | NIM, CAR, NPL, CASA oranı, kredi/mevduat, SYR |
| **Energy** | TUPRS, AKSEN, AKSA, ZOREN, ENJSA, AYGAZ | Refining margin, brent korelasyonu, kapasite, EPDK |
| **Defense** | ASELS, OTKAR, EREGL, KCHOL, KOZAL, KARSN | Backlog, R&D harcama, USD revenue %, sözleşmeler |
| **Retail** | BIMAS, MGROS, SOKM, ULKER, CCOLA, ARCLK | LFL büyüme, mağaza sayısı, sepet büyüklüğü, SSS |
| **RealEstate** | EKGYO, ISGYO, SAHOL, AGHOL, DOHOL | NAV iskonto, portföy değeri, doluluk |
| **Generic** | BIST 50 dışı / sınıflandırılamayan | P/E, P/B, ROE, EBITDA |

**Mapping:** `sector_map.yaml` (BIST 50 statik) + LLM fallback ("hangi sektör?") sınıflandırılamayan hisselerde.

## B.5 Citation-Grounded Mimari

4 katmanlı halüsinasyon savunması:

1. **Tool Provenance Logging** — Her tool call `ToolCallLog`'a yazılır: `{call_id, agent_id, tool_name, args, result, timestamp}` (UUID call_id unique).
2. **Structured Output Schemas** — Worker'lar free-form text değil, Pydantic schema döner. Her `Claim { text, citation_call_id, confidence }`.
3. **Synthesizer Citation Enforcement (ID-bazlı)** — Synthesizer her `[kaynak: <call_id>]` etiketini tool log'a karşı doğrular. ID-bazlı match deterministik.
4. **Numeric Sanity Check** — Tüm sayılar regex ile yakalanır, tool log'larda gerçekten var mı kontrol.

**Citation policy (DECISIONS final):** **1 retry**, hala başarısız ise `[KAYNAKSIZ]` flag ile soft pass. Sonsuz döngü kapalı, deterministik.

## B.6 Conservative Mode

**Tetikleme:** Orchestrator user profilinden `user_mode: "default" | "conservative"` flag'ini Synthesizer'a geçirir. UI sağ üstte toggle. Persona Ali Bey default conservative.

**Conservative davranışlar:**
1. **Bear case başa** (default'ta bull başta)
2. **Confidence üst sınırı = 70** (yüksek güvenle "AL" yok)
3. **Temettü güvenliği** başlıkları vurgulanır
4. **Volatilite uyarısı** eklenir
5. **"Bu hisse muhafazakar profil için uygun mu?"** özet cümlesi

## B.7 Güven Skoru Formülü

Synthesizer çıktısında açıklanabilir breakdown:

```
Confidence = 0.25 × Data Quality
           + 0.20 × Technical Score
           + 0.20 × Fundamental Score
           + 0.15 × News/Macro Alignment
           + 0.10 × Memory Base Rate
           + 0.10 × Devil's Advocate Inverse
```

- **Data Quality:** Tool call başarı oranı + veri tazeliği
- **Technical/Fundamental Score:** Worker'ın kendi confidence çıktısı (0-100)
- **News/Macro:** Sentiment + makro uyum (haber pozitifse +, makro karşıt rüzgar ise -)
- **Memory Base Rate:** Geçmiş benzer tezlerin actual_return ortalaması
- **Devil's Advocate Inverse:** Critique strength düşükse +, yüksekse -

**Conservative mode:** Toplam ≤70 ile cap'lenir.

---

# C. AKIŞLAR

## C.1 Uçtan Uca Sequence Diagram

**Senaryo:** Mehmet "ASELS analiz et" yazıyor.

```
0.0s    Kullanıcı: "ASELS analiz et"
0.1s    WebSocket bağlantısı açılır
        UI: "Komite toplanıyor..." animasyonu

0.5s    Orchestrator → 3-bacak PARALEL tetiklenir:
        ├─ Sector Router → "Defense Squad"
        ├─ Macro Context → cache check (15dk fresh) → paragraf
        └─ Memory Agent → similarity (top_k=3, "6 ay önce AL +%18")

2.0s    3 bacak biter, sonuçlar Orchestrator'a düşer
        UI: "Defense Squad seçildi" rozeti + makro paneli dolar

2.5s    Orchestrator 2 Worker'ı PARALEL tetikler:
        ├─ Technical: get_ohlcv → calculate_indicators (pandas-ta) → patterns
        └─ Fundamental: fetch_kap_filings → compute_ratios → peer_compare
        Her tool call UI'ya stream
        UI: 2 kolon, her biri "düşünüyor..."

2.5–20s WORKER'LAR PARALEL ÇALIŞIR (max 5 tool call her biri)
        Tool çıktıları + LLM çıkarımları stream

20s     2 Worker biter. UI: "tamamlandı" rozetleri.

20.5s   Devil's Advocate tetiklenir (Pro)
        Worker output'unu okur, base_rate_check yapar
        UI: "Devil's Advocate sorguluyor..."

20.5–28s CRITIQUE SÜRECİ
        "Technical pattern bozuluyor demiş, base rate ne?"
        critique cümleleri canlı stream

28s     Synthesizer tetiklenir (Pro, streaming)
        Markdown stream başlar (token-by-token, WebSocket push)
        UI: tez canlı yazılır (TL;DR → Bull → Bear → Catalysts...)

28–48s  SYNTHESİZER YAZIYOR

48s     Citation Validator çalışır (ID-bazlı match)
        ✅ Geçerli → DB'ye yaz
        ❌ Geçersiz → 1-retry, Synthesizer'a feedback
                     ❌ Tekrar geçersiz → [KAYNAKSIZ] soft flag

50s     Memory Agent async write (embed + pgvector)

52s     UI: tam tez görünür, indir/paylaş butonu

        Mehmet: "Bear case'i daha detaylı anlat"
        Follow-up: cached output üzerinden 2–5s
```

**Toplam:** ~52 saniye (realistic). Demo pre-warmed cache: <8 saniye.

## C.2 Cache Stratejisi

| Kaynak | TTL | Redis Key Örneği |
|---|---|---|
| Macro context | 15 dakika | `macro:context` |
| BIST endeks / global signals | 15 dakika | `macro:bist`, `macro:global` |
| yfinance OHLCV (90d) | 15 dakika | `yfinance:ASELS:ohlcv:90d` |
| Finansal tablolar (çeyreklik) | 24 saat | `fin:ASELS:Q3` |
| KAP bildirimleri | 1 saat | `kap:ASELS:filings:30d` |
| Haber | 1 saat | `news:macro`, `news:ASELS` |
| Demo hisseleri (pre-warm) | ∞ (demo süresi) | `demo:warm:<ticker>` |
| Agent state | session boyu | `agent:state:<session_id>` |
| WebSocket channel | bağlantı boyu | `ws:channel:<user_id>` |

## C.3 Citation Enforcement Akışı

```
Synthesizer Markdown üretir
        │
        ▼
┌───────────────────────────┐
│ ID-bazlı validate         │
│ Her [kaynak: <call_id>]   │
│ tool_call_logs'ta var mı? │
└──────────┬────────────────┘
           │
       ┌───┴───┐
       │       │
       ▼       ▼
     ✅ Pass  ❌ Fail (1. tur)
       │       │
       │       ▼
       │  Synthesizer'a feedback gönder
       │  ("şu cümlede ID eşleşmedi")
       │       │
       │       ▼
       │  Re-generate → 2. validate
       │       │
       │   ┌───┴───┐
       │   ▼       ▼
       │  ✅ Pass  ❌ Fail (2. tur)
       │   │       │
       │   │       ▼
       │   │   [KAYNAKSIZ] flag eklenir
       │   │   (soft pass)
       ▼   ▼       ▼
       Persist (DB write + Memory async embed)
```

**Soft flag örneği:**
> "ASELS Q3'te %23 büyüdü [kaynak: kap-2024-q3-call-id]. Yeni MILGEM sözleşmesi imzalandı [KAYNAKSIZ — doğrulanamadı]. R&D harcaması artıyor [kaynak: kap-2024-q3-call-id]."

UI'da `[KAYNAKSIZ]` etiketi turuncu rozetle gösterilir.

## C.4 Memory Read/Write + Gece Cron

**Write akışı (Synthesizer bitince):**
1. Tez metnini text-embedding-3-large ile embed (768-dim)
2. `theses` tablosuna yaz: `{ticker, thesis_date, thesis_md, bull_points[], bear_points[], catalysts[], confidence, embedding, price_at_thesis, outcome: 'pending'}`
3. `tool_call_logs` ile foreign key bağla

**Read akışı (Synthesizer öncesi):**
1. Yeni sorgu → embed
2. `pgvector` cosine similarity → top_k=3 (`ticker = current OR sector_match`)
3. Similar theses + outcome stats Synthesizer prompt'una inject:
   > "Bu hisse için 6 ay önce şöyle bir tez yazıldı: ... Outcome: +%18 (correct)."

**Gece cron (02:00 UTC, croner / APScheduler):**
1. `outcome = 'pending'` ve `thesis_date <= now - 7 days` filtrele
2. yfinance'ten ilgili tarih sonrası fiyatlar çek
3. Hesapla: `price_7d`, `price_30d`, `price_90d` ve `actual_return`
4. Outcome güncelle: bull başarılı → 'correct', %50+ ters → 'wrong', arası → 'partial'

## C.5 Demo Kill-Switch Akışı

**Amaç:** Sunum sırasında pipeline çökerse 5-10 popüler hisse için pre-baked tez otomatik gösterilir.

**Tetikleyiciler:**
- Toplam pipeline timeout > 90 saniye
- Ardışık 3 tool call fail
- Gemini rate limit (429)
- Manuel kill-switch toggle (sunum operatörü)

**Akış:**
```
Orchestrator pipeline başlat
        │
        ▼
┌─────────────────────────┐
│ Watchdog (90s timer)    │
│ + ToolFailCounter (3)   │
└──────────┬──────────────┘
           │
       ┌───┴───┐
       │       │
   ✅ OK     ❌ Trigger
       │       │
       │       ▼
       │   Fixture lookup:
       │   fixtures/<ticker>/latest.json
       │       │
       │       ▼
       │   "⚠️ Demo modu — önceden üretilmiş tez"
       │   uyarısı UI'da
       │       │
       │       ▼
       │   Pre-baked Markdown stream (yapay 8s delay
       │   ile gerçek görünür)
       │
       ▼
       Normal flow continues
```

**Fixture yapısı:** `fixtures/<ticker>/<YYYY-MM-DD>.json` — `{thesis_md, citations, generated_at, model_versions}`. Demo'dan 24 saat önce 5-10 hisse için cron ile yenilenir.

---

# D. VERİ KATMANI

## D.1 Kaynak Tablosu ve Erişim Garantileri

| Kaynak | Tip | Erişim | Garanti | Notlar |
|---|---|---|---|---|
| **TCMB EVDS** | Makro | Resmi REST API | ✅ Yüksek (ücretsiz, resmi) | TÜFE, faiz, USD/TRY, CDS. Rate: 300 req/dk |
| **MKK API Portal** | KAP bildirim + 12 servis | Resmi REST API (`apiportal.mkk.com.tr`) | ✅ Yüksek (ücretsiz, resmi) | Hesap onay süreci var → Sprint Gün 1 sabah başlat |
| **KAP RSS** | Bildirim (fallback) | RSS feed | ⚠️ Orta (resmi public, API garantisi yok) | `kap.org.tr/tr/RssAjax` |
| **isyatirim** | Fiyat + IFRS finansal tablo | PyPI `isyatirimhisse` (auth'suz JSON endpoint wrap) | ⚠️ Orta (yarı-resmi) | XI_29/IFRS/IFRS_K çeyreklik; ≤1 req/sn |
| **borsapy** | Analist tavsiyesi + scanner | PyPI `borsapy` | ⚠️ Orta (yarı-resmi) | isyatirim'in eksik bıraktığı alanlar |
| **yfinance** | Fiyat (secondary) | Python kütüphane (Yahoo) | ⚠️ Orta (yarı-resmi, .IS suffix) | Yahoo politika değişikliği riski |
| **Mynet / Bigpara (news)** | Haber | Scrape | ❌ Düşük (anti-bot riski) | Cache agresif, fixture fallback |
| **pandas-ta** | Teknik | Lokal Python (TA hesabı) | ✅ Yüksek | 130+ indikatör, kurulum sorunsuz |
| **Foreks / Matriks** | Ticari | Ücretli API | — (v2) | Lisans ₺500-5000/ay, hackathon dışı |

**Sonuç:** **TCMB EVDS** ve **MKK API** resmi ücretsiz primary kaynaklar. Diğerleri için fallback zinciri ve fixture cache zorunlu. **Tam katalog, modül-kaynak eşleştirme matrisi, onboarding prosedürleri için → [`VERI.md`](VERI.md).**

## D.2 DataProvider Interface ve Fallback Zinciri

Veri katmanı bir `DataProvider` abstract interface üzerinden çalışır:

```python
class DataProvider(Protocol):
    async def fetch(self, key: str, **kwargs) -> dict: ...

class ChainedDataProvider:
    """primary → secondary → fixture (last_known_good)"""
    def __init__(self, primary, secondary, fixture):
        self.providers = [primary, secondary, fixture]

    async def fetch(self, key, **kwargs):
        last_err = None
        for p in self.providers:
            try:
                result = await asyncio.wait_for(p.fetch(key, **kwargs), timeout=10)
                if not is_demo_mode():
                    await fixture_writer.snapshot(key, result)
                return result
            except Exception as e:
                last_err = e
                logger.warning("provider_failed", provider=p.name, key=key, err=str(e))
        raise DataUnavailable(key) from last_err
```

**Veri tipi → zincir:**

| Veri | Primary | Secondary | Fixture |
|---|---|---|---|
| BIST fiyat | yfinance | isyatirim (`isyatirimhisse`) | `fixtures/price/<ticker>.json` |
| Finansal tablo | **isyatirim** (`fetch_financials`) | yfinance financials | `fixtures/fin/<ticker>/Q<N>.json` |
| KAP bildirim | **MKK API Portal** | KAP RSS | `fixtures/kap/<ticker>.json` |
| Analist tavsiyesi | borsapy | — | `fixtures/analyst/<ticker>.json` |
| Peer compare | borsapy scanner | isyatirim manuel | `fixtures/peers/<squad>.json` |
| Makro | TCMB EVDS | TCMB enflasyon endpoint (key'siz) | `fixtures/macro/latest.json` |
| Haber | Mynet scrape | Bigpara scrape | `fixtures/news/<ticker>.json` |

**Tam registry implementasyonu ve mode bayrakları:** [`VERI.md` §5](VERI.md#5-dataprovider-interface-ve-registry).

**Fixture writer:** Her başarılı `fetch()` sonrası 48 saatlik snapshot diske yazılır (`last_known_good`). Demo'dan önce manuel olarak güncel hale getirilir.

## D.3 TCMB EVDS API Kayıt Prosedürü

**Sprint Gün 1 görevi.** Adımlar:

1. https://evds2.tcmb.gov.tr → "Üye Ol" → e-posta + telefon doğrulama (~5 dakika)
2. Login → "Profil" sekmesi → "API Anahtarı" → "Anahtar Oluştur"
3. Anahtarı `.env` dosyasına ekle:
   ```
   TCMB_EVDS_KEY=xxxxxxxxxxxxxxxxx
   ```
4. Test endpoint:
   ```bash
   curl "https://evds2.tcmb.gov.tr/service/evds/series=TP.AB.A01&startDate=01-01-2026&endDate=01-05-2026&type=json&key=$TCMB_EVDS_KEY"
   ```
5. Rate limit: 300 req/dakika (gerçek pratikte daha düşük tutulması önerilir). Yanıt formatı JSON. Önemli seri kodları:
   - `TP.DK.USD.A.YTL` — USD/TRY günlük
   - `TP.AB.A01` — TÜFE aylık
   - `TP.PY.P01.TRY` — TCMB politika faizi
   - `TP.MK.F.BIST` — BIST 100 endeks

### D.3.2 MKK API Portal Kayıt Prosedürü (KAP resmi REST API)

**Sprint Gün 1 SABAH 09:00 görevi** — onay süresi belirsiz, en erken başlat. Detay: [`VERI.md` §6.2](VERI.md#62-mkk-api-portal-yeni--kritik).

1. `https://apiportal.mkk.com.tr/` → "Üye Ol" → e-posta + telefon doğrulama
2. Hesap onayı bekle (manuel onay olabilir; sorun: `kapdestek@mkk.com.tr`)
3. Login → "Uygulamalarım" → "Yeni Uygulama" → API key
4. `.env`:
   ```
   MKK_API_KEY=xxxxxxxxxxxxxxxx
   ```
5. "KAP Bildirim" servisine abone ol (12 servisten birisi). Doküman: `https://kap.org.tr/tr/api/about/content-file/8a019492945fbe080194b26d8bed4873` (PDF)
6. **Plan B:** Gün 3'e kadar onay yoksa **KAP RSS primary'de kalır**, MKK v1.1'e ertelenir (Risk #14).

## D.4 Maliyet Tahmini

| Kalem | Maliyet (hackathon 7 gün) |
|---|---|
| Gemini API (Tier 1 paid, ~1000 tez test) | $10–20 |
| Supabase (PostgreSQL + pgvector) | $0 (free tier) |
| Upstash (Redis) | $0 (free tier) |
| Vercel (Next.js) | $0 (hobby) |
| Railway / Fly.io (FastAPI) | $0 (free tier) |
| TCMB EVDS | $0 (resmi ücretsiz) |
| yfinance / KAP / Mynet / pandas-ta | $0 |
| **Toplam** | **$10–20** |

**Üretim (v2):** Foreks lisansı ₺500-5000/ay + Gemini Pro tier scale ile birlikte aylık ~$200-500 öngörülüyor.

---

# E. TEKNOLOJI YIĞINI

### Backend

```toml
python = "^3.11"
fastapi = "*"               # Async-native, WebSocket
uvicorn = "*"               # ASGI server

# AI
strands-agents = "*"        # Multi-agent orchestration
strands-agents-tools = "*"  # Tool framework
google-generativeai = "*"   # Gemini 2.5 Pro/Flash SDK

# Data
yfinance = "*"              # BIST .IS suffix
pandas-ta = "*"             # Teknik analiz (TA-Lib değil — saf Python)
beautifulsoup4 = "*"        # KAP/news scraping
playwright = "*"            # KAP fallback scrape (Chromium)
httpx = "*"                 # Async HTTP
pandas = "*"
pydantic = "*"              # Schema validation
gray-matter = "*"           # Markdown frontmatter (gerekirse)

# Persistence
sqlalchemy = "*"
psycopg2-binary = "*"
alembic = "*"               # Migration
redis = "*"
pgvector = "*"

# Observability
opentelemetry-api = "*"
opentelemetry-sdk = "*"
structlog = "*"

# Test
pytest = "*"
pytest-asyncio = "*"
pytest-cov = "*"
```

### Frontend

```json
{
  "next": "^15",
  "react": "^19",
  "tailwindcss": "*",
  "shadcn/ui": "*",
  "recharts": "*",
  "lucide-react": "*"
}
```

WebSocket: native `WebSocket` API + **auto-reconnect** + **REST polling degrade** (aşağıda E.1).

### E.1 WebSocket Reconnect + REST Degrade

```typescript
class ResilientThesisClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private maxRetries = 3;
  private pollingTimer: number | null = null;

  connect(sessionId: string) {
    this.ws = new WebSocket(`/ws/thesis/${sessionId}`);
    this.ws.onopen = () => { this.retries = 0; };
    this.ws.onclose = () => this.handleDisconnect(sessionId);
    this.ws.onerror = () => this.handleDisconnect(sessionId);
    this.ws.onmessage = (e) => this.onToken(JSON.parse(e.data));
  }

  private handleDisconnect(sessionId: string) {
    if (this.retries < this.maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      setTimeout(() => { this.retries++; this.connect(sessionId); },
                 1000 * Math.pow(2, this.retries));
    } else {
      // Degrade to REST polling
      this.startPolling(sessionId);
    }
  }

  private startPolling(sessionId: string) {
    this.pollingTimer = setInterval(async () => {
      const res = await fetch(`/api/thesis/${sessionId}/status`);
      const data = await res.json();
      data.new_tokens?.forEach((t: any) => this.onToken(t));
      if (data.done) clearInterval(this.pollingTimer!);
    }, 2000);
  }
}
```

Backend tarafı: `GET /api/thesis/<id>/status` endpoint'i son token offset'i sonrası tüm token'ları döner. Streaming UX biraz bozulur ama tez yine de tamamlanır.

### Deploy

| Bileşen | Servis | Plan |
|---|---|---|
| Backend | Railway veya Fly.io | Free tier Python |
| Frontend | Vercel | Next.js hobby |
| PostgreSQL + pgvector | Supabase | Free tier (pgvector built-in) |
| Redis | Upstash | Free tier serverless |
| Fixture storage | Disk (backend container) | — |

**Local dev:** `docker-compose.yml` ile postgres+pgvector, redis, backend, frontend tek komutla ayağa.

---

# F. PERSISTENCE ŞEMALARI

## F.1 PostgreSQL Tabloları

```sql
-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','b2b')),
  user_mode TEXT NOT NULL DEFAULT 'default' CHECK (user_mode IN ('default','conservative')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE watchlist (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);

CREATE TABLE theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  squad TEXT NOT NULL,
  user_mode TEXT NOT NULL,
  thesis_date TIMESTAMPTZ DEFAULT now(),
  thesis_md TEXT NOT NULL,
  bull_points JSONB,
  bear_points JSONB,
  catalysts JSONB,
  confidence FLOAT,
  confidence_breakdown JSONB,
  embedding VECTOR(768),
  price_at_thesis NUMERIC,
  price_7d NUMERIC,
  price_30d NUMERIC,
  price_90d NUMERIC,
  ground_truth_return FLOAT,
  outcome TEXT CHECK (outcome IN ('correct','partial','wrong','pending')) DEFAULT 'pending',
  had_kaynaksiz_flag BOOLEAN DEFAULT false
);

CREATE INDEX idx_theses_embedding ON theses USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_theses_ticker_date ON theses (ticker, thesis_date DESC);

CREATE TABLE tool_call_logs (
  call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args JSONB,
  result JSONB,
  latency_ms INT,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tool_call_logs_thesis ON tool_call_logs (thesis_id);

CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  call_id UUID REFERENCES tool_call_logs(call_id),
  is_kaynaksiz BOOLEAN DEFAULT false
);
```

## F.2 Redis Key Şeması

```
macro:context                       TTL 15dk   → JSON paragraf
macro:bist                          TTL 15dk   → BIST endeks state
yfinance:<TICKER>:ohlcv:90d         TTL 15dk   → DataFrame JSON
fin:<TICKER>:Q<N>                   TTL 24h    → Financial statements
kap:<TICKER>:filings:30d            TTL 1h     → KAP filings array
news:<TICKER>                       TTL 1h     → News array
news:macro                          TTL 1h     → Macro news
demo:warm:<TICKER>                  TTL ∞      → Pre-warmed full thesis
agent:state:<session_id>            TTL session→ Strands state
ws:channel:<user_id>                TTL conn   → Pub/sub channel
ratelimit:gemini:<minute>           TTL 60s    → Counter
```

## F.3 Fixture Store (Disk)

```
fixtures/
├── price/
│   ├── ASELS.json         # Son 90 gün OHLCV
│   └── TUPRS.json
├── kap/
│   ├── ASELS.json         # Son 30 gün filings
│   └── ...
├── news/
│   └── ...
├── macro/
│   └── latest.json
└── thesis/                # Demo kill-switch için pre-baked tez
    ├── ASELS/2026-05-12.json
    ├── TUPRS/2026-05-12.json
    └── ...
```

Format: `{key, fetched_at, ttl_hours, payload}`. Demo öncesi `scripts/refresh_fixtures.py` ile güncellenir.

---

# G. SPRINT PLANI (7 GÜN, 3 KİŞİ)

**Ekip:**

| Rumuz | Rol | Sorumluluk | Stack |
|---|---|---|---|
| **A** | Agent Lead | Backend ajanlar, LLM, Synthesizer, Devil's, citation | Python, FastAPI, Gemini SDK, pydantic |
| **B** | Data/DevOps Lead | Veri, persistence, Docker, CI/CD | Python, SQL, Docker, GitHub Actions |
| **C** | Frontend Lead | UI/UX, demo | Next.js 15, Tailwind, shadcn/ui, recharts |

## G.1 Gün-Gün Görev Tablosu

### Gün 1 — Foundation & Setup
**A:** Repo iskelet (`backend/`, `frontend/`, `docker/`), FastAPI `/health`, **Gemini Tier 1 paid plan aktif**, dummy agent (echo). `POST /chat` çalışır.
**B:** `docker-compose.yml` (postgres+pgvector, redis, backend, frontend), `.env.example`, alembic migration framework + ilk migration (users, theses, tool_call_logs, citations). **TCMB EVDS API anahtarı kaydı (D.3) + MKK API Portal kaydı (D.3.2) — onay gecikme riski, gün başında 09:00'da başlat.** `pip install isyatirimhisse borsapy yfinance pandas-ta` smoke test.
**C:** Next.js 15 + Tailwind + shadcn/ui. Layout (header, sidebar/watchlist, main/chat). Mock chat UI.
**Senkron:** `docker compose up` → tüm servisler 200.

### Gün 2 — Data Pipeline & Macro Context
**A:** Agent base class (`BaseAgent`), Macro Context Agent (Flash, 15dk cache), Orchestrator iskeleti, prompt registry.
**B:** `tools/yfinance_tool.py`, `tools/kap_rss_tool.py`, `tools/pandas_ta_tool.py`, `tools/tcmb_evds_tool.py`. **`DataProvider` interface + `ChainedDataProvider` (primary→secondary→fixture).** Redis cache wrapper. `sector_map.yaml` (BIST 50, 5+1 squad). Unit test: GARAN NIM doğru.
**C:** Backend `/api/macro` bağlantısı (gerçek), watchlist component (ekleme/çıkarma), chat input + REST polling.
**Senkron:** Macro Agent JSON üretir, UI'da panel canlı.

### Gün 3 — Workers + Sector Router
**A:** Sector Router Agent, Technical Worker (pandas-ta, max 5 tool), Fundamental Worker (5 squad-spesifik sub-prompt: Banking/Energy/Defense/Retail/RealEstate/Generic), Orchestrator paralel dispatch (`asyncio.gather`).
**B:** KAP scraper fallback (Playwright, 1 req/sn, robots.txt saygısı). Worker output Pydantic şemaları. `citations` tablosu yazma (her tool call → call_id). Unit test: Sector Router 50 hisse → doğru squad. Fixture writer ilk versiyon.
**C:** Thesis Viewer iskeleti (Markdown render, grafik placeholder). Worker status UI (her worker kart, pending/done/error). Squad badge. Mobile responsive.
**Senkron:** ASELS isteği → Sector Router → 2 worker paralel → JSON UI'da.

### Gün 4 — 🎯 MVP: Devil's + Synthesizer + Citation
**A:** Devil's Advocate Agent (**Pro**, bear argümanları), Synthesizer Agent (**Pro**, streaming Markdown), Synthesizer prompt (bull/bear/catalysts/risks/confidence breakdown). `user_mode` parametresi taslağı. Citation Validator (ID-bazlı + 1-retry + `[KAYNAKSIZ]` flag).
**B:** Tez DB yazma: embedding + pgvector. Memory Agent write-only. `compute_ratios` integration test (3 squad). Citation Validator unit test (bozuk citation fixture). Smoke test CLI (e2e).
**C:** Thesis Viewer Markdown stream render (token-by-token). Bull/Bear collapsible. Citation tooltip. Confidence bar (recharts). `[KAYNAKSIZ]` flag uyarı stilleri.

**🎯 MVP TANIMI (Gün 4 sonu):**
1. Tek hisse bull/bear/catalysts/risks
2. Citation-grounded (1-retry + soft flag)
3. Memory Agent yazıyor (similarity henüz yok)
4. Smoke test 3 hisse yeşil (ASELS, GARAN, TUPRS), e2e <60s

### Gün 5 — Frontend Tamamlama + WebSocket + Memory Similarity
**A:** WebSocket endpoint (`/ws/thesis`), Memory similarity search (top_k=3 inject), Memory prompt template, Orchestrator WS-aware event push.
**B:** Memory read path: `similar_thesis(ticker, top_k)` pgvector cosine. Gece cron iskeleti (henüz koşmuyor). 3 fake tez + similarity test. Integration test (mock LLM ile e2e). **GitHub Actions: PR unit + integration.**
**C:** WebSocket client + **auto-reconnect + REST polling degrade** (E.1). Streaming UI (typing animation). "Geçmiş Tezler" panel (zaman çizelgesi). Similarity kart. Watchlist gerçek backend CRUD.

### Gün 6 — Conservative Mode + Tests + Polish
**A:** Conservative mode tam (bear başa, confidence cap=70, temettü vurgulu, volatilite uyarısı, uygunluk özeti). Edge case'ler (zayıf veri graceful degrade). **Pre-warmed cache mekanizması (5-10 demo hissesi).**
**B:** Coverage >%70 kritik path (validate_citations, sector_router, memory similarity, pipeline). Smoke 5 hisse (gerçek LLM). Gece cron çalışır hale (manuel test). **Demo kill-switch implementasyonu (watchdog + fixture lookup, C.5).** Prod env vars + secrets review. Demo deploy (Railway + Supabase + Upstash + Vercel).
**C:** Conservative UI toggle (Ali Bey persona default). Demo animasyonlar. Empty state UI'lar. Error boundaries + retry. Mobile + tablet son geçiş.
**Senkron:** End-to-end dry run.

### Gün 7 — Demo + Video + Submission
**A:** Sunum teknik kısım (mimari slide, ajan ailesi, Pro/Flash split, kill-switch). Canlı demo 3 persona. Edge case fallback'leri. Q&A notları.
**B:** Production smoke test. Pre-warmed cache final populate (kill-switch fixture'larını da güncelle). `README.md`, `BLUEPRINT.md` finalize. GitHub repo temizlik (secret kontrol). Submission deploy URL test.
**C:** Sunum ürün kısım (personalar, problem, değer). **Demo video kaydı (3-5dk, scripted):**
1. Mehmet ASELS (default, streaming, citation tooltip)
2. Ali Bey TUPRS (conservative, bear başta)
3. Memory similarity (6 ay önce ASELS tezi)

**Submission checklist:**
- [ ] GitHub repo public + README
- [ ] Demo video link (YouTube/Drive)
- [ ] Canlı demo URL
- [ ] Sunum slide (PDF)
- [ ] BLUEPRINT.md
- [ ] Submission formu

## G.2 Daily Ritüel

- **09:00** — 15dk standup (dün/bugün/blocker)
- **12:30** — Hızlı sync
- **18:00** — Demo dry run (Gün 4'ten itibaren, 5dk)
- **22:00** — Soft cutoff (commit + push, ertesi güne hazır)

## G.3 Risk Öncelik Tablosu

| Öncelik | Feature | Fallback |
|---|---|---|
| 🔴 Vazgeçilmez | Tek hisse tam tez + citation + DB write | MVP yok |
| 🟡 Önemli | WebSocket streaming + reconnect | REST polling degrade |
| 🟡 Önemli | Memory similarity inject | Sadece write |
| 🟡 Önemli | Conservative mode | UI toggle var, backend default |
| 🟡 Önemli | Demo kill-switch | Manuel sunum sırasında "fixture göster" |
| 🟢 Nice-to-have | Pre-warmed cache | Demo'da canlı 60s |
| 🟢 Nice-to-have | Coverage >%70 | Citation + router testi |
| 🟢 Nice-to-have | Production deploy | Local + screen share |

---

# H. TEST VE GÖZLEMLENEBİLİRLİK

## H.1 Test Stratejisi

**Unit testler (öncelik):**
- `validate_citations()` — bozuk citation'lı tez fixture'ı geçer mi
- `sector_router` — 50 BIST hissesi → doğru squad
- `compute_ratios()` — bilinen finansal table karşılaştır
- `chained_data_provider` — primary fail → secondary, ikisi fail → fixture
- `memory.similar_thesis` — 3 fake tez insert, doğru sıra

**Integration testler:**
- End-to-end pipeline (mock Gemini ile, deterministik)
- Memory similarity round-trip
- Citation enforcement loop (kasten kırık çıktı → retry → soft flag)

**Smoke testler (gerçek LLM, gece cron):**
- 5 popüler hisse: ASELS, GARAN, TUPRS, BIMAS, EREGL
- Beklenen: <90s, citation pass, DB row ekleniyor

**CI (GitHub Actions):**
- PR: unit + integration (mock LLM)
- Nightly: smoke (gerçek LLM, secret env var)

**Coverage hedefi:** Kritik path'lerde **>%70**.

## H.2 Gözlemlenebilirlik

- **OpenTelemetry** trace: her ajan span (`agent.synthesizer`, `agent.devil`), her tool span (`tool.yfinance.get_ohlcv`). Strands native destek.
- **structlog** JSON format: `{level, ts, event, ticker, agent_id, call_id, latency_ms, ...}`
- **Metrikler:**
  - `thesis.generation_duration_seconds` (histogram)
  - `tool.call.count` (counter, labels: tool, success)
  - `citation.kaynaksiz_count` (counter)
  - `gemini.tokens_used` (counter, labels: model)
  - `kill_switch.trigger.count` (counter, labels: reason)
- **Local dashboard:** Demo'dan önce manuel kontrol. Production'da Grafana opsiyonel (v2).

---

# I. RİSK TABLOSU

| # | Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|---|
| 1 | KAP RSS kırılır | Orta | Düşük | **MKK API primary** (resmi REST), RSS fallback, 48 saat fixture snapshot |
| 14 | MKK API Portal onayı 7 günden uzun sürer | Orta | Orta | KAP RSS primary'de kalır, MKK v1.1'e ertelenir (Gün 1 sabah başvur) |
| 15 | isyatirim/borsapy IP-ban | Düşük | Yüksek | ≤1 req/sn ortak rate, agresif cache, yfinance secondary |
| 2 | yfinance Yahoo politika değişir | Düşük | Yüksek | TwelveData free tier secondary, fixture fallback |
| 3 | Gemini rate limit (429) | Orta | Yüksek | Exponential backoff, Flash öncelikli, cache agresif, kill-switch |
| 4 | Citation validator sonsuz loop | — | — | **1-retry + `[KAYNAKSIZ]` soft pass** (DECISIONS final) |
| 5 | Devil's Advocate prompt zayıf | Orta | Yüksek | 3-4 prompt version A/B test, Gün 4-5 |
| 6 | BIST kapalı demo (akşam/hafta sonu) | Düşük | Orta | Pre-warmed cache + kill-switch fixture |
| 7 | Strands A2A protocol olgun değil | — | — | **Agent-as-Tool fallback** (DECISIONS final) |
| 8 | KAP scraping legal/ToS | Düşük | Yüksek (legal) | RSS-first, saygılı scrape (1 req/sn, robots.txt), belirgin User-Agent |
| 9 | TA-Lib kurulum zorluğu (Linux) | — | — | **pandas-ta** (DECISIONS final, saf Python) |
| 10 | Sunum sırasında pipeline çöker | Orta | Yüksek | **Demo kill-switch** (90s timeout veya 3 fail → fixture tez) |
| 11 | WebSocket bağlantı kopar | Orta | Düşük | **Reconnect + REST polling degrade** (E.1) |
| 12 | Sentiment yanlış (Türkçe NLP) | — | — | **Sentiment Worker v2'ye atıldı** (DECISIONS final) |
| 13 | Gemini API key Google tarafından askıya alınır | Düşük | Çok Yüksek | **Tek hesap + Tier 1 paid** (DECISIONS final), ToS uyumlu kullanım |

---

# J. DEMO STRATEJİSİ

## J.1 Üç Senaryo

**Senaryo 1 — Mehmet (default mode) — ASELS**
- Watchlist'ten "ASELS analiz et" → 8 ajan tam pipeline
- Memory: "6 ay önce AL +%18" similarity inject
- Streaming Markdown (token-by-token)
- Citation tooltip hover → ilgili tool çağrısı görünür
- Süre: ~52s canlı (pre-warm cache yoksa)

**Senaryo 2 — Ali Bey (conservative mode) — TUPRS**
- Aynı pipeline + `user_mode=conservative`
- Bear case başa, confidence cap=70, temettü vurgulu
- "Bu hisse muhafazakar profil için uygun mu?" özet cümlesi
- Süre: ~48s

**Senaryo 3 — Memory Similarity Wow-Factor**
- Demo'dan 6 ay önce yazılmış sahte tez DB'ye seed edilmiş (`outcome=correct`, `actual_return=+18%`)
- Yeni sorgu → Synthesizer prompt'una similarity inject → tez içinde "tarihsel bağlam" bölümü
- Judge'a wow

## J.2 Pre-Warmed Cache Listesi

Demo 24 saat öncesinden `scripts/warmup.py` ile doldurulan 10 hisse:

```
ASELS, GARAN, TUPRS, BIMAS, EREGL,
THYAO, AKBNK, KCHOL, SISE, ULKER
```

Her hisse için:
- `yfinance:<T>:ohlcv:90d` Redis'e
- `kap:<T>:filings:30d` Redis'e
- `demo:warm:<T>` Redis'e (tam tez Markdown)
- `fixtures/thesis/<T>/<date>.json` diske (kill-switch için)

## J.3 Kill-Switch Operatör Kontrolü

Sunum sırasında 1 ekip üyesi "demo operator" rolünde:
- Sunum laptop'ında `?force_demo=1` query param ile kill-switch'i manuel tetikleyebilir
- Pipeline 90s aşarsa veya 3 tool fail otomatik tetiklenir
- UI'da küçük "⚠️ Demo modu — önceden üretilmiş tez" rozeti gösterilir (dürüstlük)

## J.4 Video Kayıt Scripti (3-5 dk)

```
0:00 — Problem: Türkiye retail yatırımcı tablosu (kısa görsel)
0:30 — ThesisForge tanıtımı (tek cümle pitch + tablo)
1:00 — Senaryo 1: Mehmet ASELS (canlı stream, citation hover)
2:15 — Senaryo 2: Ali Bey TUPRS (conservative mode farkı)
3:15 — Senaryo 3: Memory similarity (6 ay önce)
4:00 — Mimari özet (8 ajan, Pro/Flash split, citation-grounded)
4:30 — Tech + sprint + v2 roadmap teaser
5:00 — Disclaimer + ekip + GitHub link
```

---

# K. v2 ROADMAP

Hackathon sonrası eklenecek özellikler:

1. **Sentiment Worker** (3. paralel worker)
   - Reddit `r/borsaistanbul`, `r/turkfinance`
   - Ekşi Sözlük başlık tracker
   - Telegram public kanalları (ücretsiz)
   - Türkçe sentiment fine-tuning (XLM-RoBERTa + Türkçe finance corpus)

2. **Backtest Validator** (9. ajan)
   - `as_of_date` parametresi tüm tool'larda tarih kilidi
   - Pipeline'ı geçmiş tarih için çalıştır → outcome ile karşılaştır
   - Time-leakage savunması: KAP filings tarih filtre, fiyat lookahead yasak

3. **True A2A Protocol** (Strands olgunlaştığında)
   - Devil's Advocate ↔ Workers gerçek bidirectional dialogue
   - "Pattern bozulduğunu söylüyorsun, son 12 ay base rate ne?" → Technical worker base_rate_check tool çağırır → yanıt döner

4. **Multi-user + B2B White-Label**
   - Tenant izolasyonu
   - Aracı kurum branding
   - Toplu watchlist + sabah brifing PDF

5. **Mobile (PWA → Native)**
   - Push notification: watchlist tez güncellendi
   - Offline tez okuma

6. **Premium Data Layer**
   - Foreks / Matriks lisansı
   - Real-time tick data
   - Analist tahmin agregasyonu

7. **Sosyal Özellikler**
   - Tezler için yorum + tartışma
   - "Bu tezi takip ediyorum" + portföy bağlantısı
   - Topluluk doğruluk skorboard (transparency)

---

## EK — Dokümantasyon Geçmişi

Bu BLUEPRINT.md, aşağıdaki erken planlama dosyalarının tek tutarlı sentezidir. Hepsi `archive/` altında erişilebilir:

- `archive/Analiz.md` — ürün vizyonu + 15 maddelik kritik inceleme
- `archive/FLOW.md` — sequence diagram + cache stratejisi (8 ajan, 2 worker)
- `archive/DECISIONS.md` — 15 maddenin finalize edilmiş kararları (2026-05-10)
- `archive/SPRINT.md` — 7 günlük plan
- `archive/Rapor.md` — eski öneri raporu (geçersiz)
- `archive/prompt.md` — orijinal brief (geçersiz)
- `archive/DEXTER_ANALIZ.md` — github.com/virattt/dexter analizi (sadece ilham, projeye dahil değil)

**Çelişki halinde BLUEPRINT.md doğru olandır.**
