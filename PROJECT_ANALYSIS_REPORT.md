# ThesisForge — Kapsamlı Proje Analiz Raporu

**Tarih:** 2026-05-17  
**Branş:** `develop` · **Son commit:** `d5be43c` (deterministic pattern observation + backtest scripts)  
**Teslime:** ~6 gün · **Takım:** 3 kişi (A: Agent Lead · B: Data/DevOps · C: Frontend)  
**Hazırlık Skoru:** **7.9/10** — 🟢 MVP → Demo-Ready · ⚠️ 3 kritik bulgu var

---

## 0. Yönetici Özeti

ThesisForge, BIST hisseleri için **citation-grounded, memory-aware, çok-ajanlı yatırım tezi üreteci** olarak hedeflenen MVP'sine ulaşmıştır. Backend pipeline'ı tam (8 ajan implement, orchestrator DAG 12 adım, REST+WS, pgvector memory), smoke test 5/5 yeşil, dokümantasyon 17 modüler dosyada zengin. Ancak repo kökündeki 4 demo tezi incelendiğinde, **demo öncesi acilen ele alınması gereken üç bulgu** ortaya çıkmaktadır:

| # | Bulgu | Etki | Aciliyet |
|---|-------|------|----------|
| 1 | **MEPET'te iki üretim arasında temel finansal veriler çelişiyor** (ROE %14.5 ↔ %6.01; Net marj %8.1 ↔ %4.17; D/E 0.7 ↔ 0.15) | Halüsinasyon/veri tutarlılığı şüphesi — sunumda canlı tek soruyla çökebilir | 🔴 P0 |
| 2 | **Sektör yönlendirmesi başarısız:** MEPET (petrol) ve THYAO (havacılık) tezleri `Generic` squad'a düşmüş, oysa güncellenen `sector_map.yaml` her ikisini doğru bağlıyor | Squad-spesifik fundamental prompt'lar kullanılmamış; tezlerin değer önerisi (5+1 squad) zayıflıyor | 🔴 P0 |
| 3 | **Demo paketi eksik:** sunum slaytları yok, demo video kaydı yok, `feature/frontend` branch'i `develop`'a merge edilmemiş, prod deploy denenmemiş | Teslim günü görsel kalite ve canlı demo riski | 🔴 P0 |

Bunların dışında: CI/CD `.github/workflows/` yok, OpenAPI `/docs` expose edilmemiş, Conservative mode smoke testi yapılmamış, ruff/mypy/pre-commit config yok. Bunlar P1/P2'dir, hackathon teslimini engellemez ama jüri kod kalite sorusu sorarsa açık verebilir.

**Tek cümleyle:** Sistem işliyor; iki teknik bulguyu kapat, demo paketini tamamla, deploy doğrula — geri kalan zaten yerinde.

---

## 1. Mimari Anlık Görüntü

### 1.1 Dizin Yapısı

```
btk-hackathon-26/
├── backend/                          # FastAPI + Strands Agents
│   ├── app/
│   │   ├── agents/                   # 8 ajan + orchestrator + runtime
│   │   ├── api/                      # REST + WebSocket
│   │   ├── citations/                # 3-katmanlı kaynak doğrulama
│   │   ├── core/                     # config, structlog
│   │   ├── data/                     # provider chain (yfinance→isyatirim→fixture)
│   │   └── db/                       # SQLAlchemy + Alembic + pgvector
│   ├── tests/{unit,integration}/     # 9 test dosyası, ~1838 satır
│   ├── scripts/                      # smoke + backtest + warmup
│   ├── sector_map.yaml               # 18 squad, 420+ hisse
│   ├── TESTING.md                    # 334 satır manuel test rehberi
│   └── pyproject.toml                # Pinned dependencies
├── docs/                             # 17 modüler doküman
├── thesis_output_*.md                # 4 staged demo tezi (ASELS/MEPET×2/THYAO)
├── demo_smoke_results.json           # 5 hisse smoke run sonuçları
├── docker-compose.yml                # postgres+pgvector + pgbouncer
└── README.md
```

`feature/frontend` branch'inde Next.js 15 frontend (Aurora UI, glass morphism, `/app/thesis/new` live runner) tamamlanmıştır ama henüz `develop`'a alınmamıştır.

### 1.2 Ajan Envanteri (8/8 ✅)

| # | Ajan | Dosya | Satır | Görev | Durum |
|---|------|-------|-------|-------|-------|
| 1 | Sector Router | `agents/sector_router.py` | 26 | Rule-based squad ataması | ✅ |
| 2 | Macro Context | `agents/macro_context.py` | 41 | TCMB EVDS + XU100 sentiment | ✅ |
| 3 | Technical Worker | `agents/technical_worker.py` | 355 | RSI/MACD/Bollinger + momentum | ✅ |
| 4 | Fundamental Worker | `agents/fundamental_worker.py` | 185 | Squad-spesifik metrik analizi | ✅ |
| 5 | Devil's Advocate | `agents/devils_advocate.py` | 90 | Karşı argüman üretici (Pro model) | ✅ |
| 6 | Synthesizer | `agents/synthesizer.py` | 475 | Markdown tez + extract + conservative | ✅ |
| 7 | Memory Agent | `agents/memory_agent.py` | 121 | pgvector cosine top-k=3 | ✅ |
| 8 | Orchestrator | `agents/orchestrator.py` | 374 | 12-adımlı DAG + retry + WS event | ✅ |

Yardımcı modüller: `runtime.py` (Gemini Flash/Pro wrapper, 215), `confidence.py` (skor hesabı + conservative cap, 88), `strands_tools.py` (tool decorator + call_id, 261), `tool_registry.py` (10+ tool, 441), `schemas.py` (Pydantic, 230), `embedding.py` (88), `tools.py` (148), `sector_map.py` (49).

**Toplam ajan-katmanı:** 3 187 satır Python — manageable, audit edilebilir.

**v2'ye deferred (kasıtlı, dokümante):** Sentiment Worker (Reddit/Ekşi feed) ve Backtest Validator Agent (as-of-date ground truth feedback loop). Bu kararı `docs/roadmap.md` ve `docs/agents.md` belgeliyor — jüri sorduğunda "scope discipline" cevabı verilebilir.

### 1.3 Orchestrator DAG (12 adım)

```
1-2. Skeleton + Paralel 4 bacak:
     ├── sector_router (rule-based, sync)
     ├── macro_context  (Gemini Flash, 8192 token)
     ├── memory_agent   (embed + pgvector top_k=3)
     └── technical_worker (yfinance + pandas-ta)
3.   Paralel 2: fundamental_worker (squad-bağımlı prompt)
4.   Devil's Advocate (Gemini Pro, 16384 token)
5-6. Macro_context join (synthesizer'a gerekli)
7-8. Synthesizer (Pro, MD üret) → Citation Validator (3 katman)
        ↳ Validator fail ise 1× synthesizer feedback retry
9.   Paralel: structured_output extract + WS token stream
10.  DB persist + embedding async fire-and-forget
11-12. thesis_id emit + WS done event
```

Smoke test gözlemi: 93–109 s/ticker. Sebep: Gemini free tier RPM=5 → 8 paralel çağrı sırada bekliyor. Tier 1 billing açıldığında <60 s'ye düşmesi beklenir.

### 1.4 Squad Sistemi (`backend/sector_map.yaml`)

18 kategori, 420+ hisse, her squad'ın:
- **tickers:** liste
- **metrics:** squad-spesifik (örn. Energy: `[refining_margin, brent_korelasyon, kapasite, EPDK_tarife, kapasite_kullanim]`)
- **prompt:** `agents/prompts/fundamental_<squad>.md` dosyası

Üretilen tezlerde gerçekleşen squad atamaları:

| Ticker | Beklenen squad (sector_map.yaml) | Tezde geçen squad | Durum |
|--------|----------------------------------|--------------------|-------|
| ASELS  | Defense | Defense | ✅ |
| MEPET  | Energy  | **Generic** | ❌ |
| THYAO  | Transportation | **Generic** | ❌ |

**Yorum:** Tezler **eski (genişletilmemiş) sector_map.yaml** ile üretildi, yaml ardından güncellendi. `git status` çıktısı `M backend/sector_map.yaml` ve `M backend/app/agents/sector_map.py` bunu doğruluyor. Yeni map ile yeniden üretim yapıldığında MEPET → Energy (refining_margin, brent_korelasyon prompt'u) ve THYAO → Transportation (yolcu_yuk_sayisi, doluluk_orani prompt'u) düşmeli — kalite belirgin artmalı.

### 1.5 LLM Katmanı

`agents/runtime.py:_gemini_model()` LRU-cache'li factory:

| Model | Token | Kullanım |
|-------|-------|----------|
| `gemini-2.5-flash` | 8192 | Workers + extractor |
| `gemini-2.5-pro`   | 16384 | Devil's Advocate + Synthesizer |

**Retry (commit `07b8c6e`):** 503/429/500/`DEADLINE_EXCEEDED` üzerinde 3 deneme, 3 s → 8 s → 15 s backoff. Synthesizer ayrıca citation validator fail ederse 1× feedback retry yapar.

### 1.6 Memory Katmanı

`agents/memory_agent.py` (121 satır) + `agents/embedding.py` (88 satır):

- **Yazma:** Tez persist edilince embedding async oluşturulup `theses.embedding` (pgvector 768) sütununa yazılır (fire-and-forget; `asyncio.create_task`).
- **Okuma:** Yeni tez için aynı ticker + benzer squad filtresi ile cosine similarity top_k=3 çekilir → Synthesizer prompt'una "Tarihsel Bağlam" olarak inject edilir.
- **Outcome correction:** `MemoryHit.outcome ∈ {correct, partial, incorrect, pending}` + `ground_truth_return` → tezde alıntılanır.

ASELS tezindeki "Tarihsel Bağlam" bölümü canlı: 2025-07-08 ASELS tezi %19.3 getiri ile `correct` etiketlenmiş, 2025-03-25 KCHOL `partial` (%5.2), 2026-05-16 ASELS (aynı gün önceki çalıştırma) `pending`. Sistem çalışıyor — ancak **memory pool'un kalitesi audit edilmemiş** (return doğruluğu, tarih bütünlüğü).

### 1.7 API ve WebSocket

`backend/app/api/`:

| Endpoint | Metod | Görev |
|----------|-------|-------|
| `/health` | GET | Liveness |
| `/chat` | POST | `{ticker, user_mode}` → `thesis_id` |
| `/ws/thesis/{thesis_id}` | WS | Event stream (`agent_start`/`stage`/`token`/`critique`/`done`/`error`) |
| `/api/thesis/{id}` | GET | Tez JSON (md + bull/bear/catalysts + confidence) |
| `/api/thesis/{id}/citations` | GET | Citation audit (call_id → tool_result eşlemesi) |

**Kill-switch:** `?force_demo=1` query param ile fixture stream (`fixtures/thesis/<T>.json`, 8 s yapay delay) — sunumda Gemini quota dolarsa B planı.

**Tek worker uvicorn:** WS hub in-memory dict olduğu için multi-worker'da event loss riski var (dokümante). Production'da Redis pub/sub'a geçilmesi planlı.

---

## 2. Üretilen Tezlerin Derin Kalite Analizi

Repo kökündeki 4 dosya (`thesis_output_*.md`) staged durumda. Her birini sırayla inceliyoruz.

### 2.1 ASELS_default — Confidence 64.44/100 ✅ En İyi Tez

**Squad:** Defense (doğru) · **Thesis MD:** 6 361 karakter · **Kaynaksız flag:** False · **Citation oranı:** 14/20 kaynaklı (70%).

**Güçlü yönler:**

- **Somut, sektör-uyumlu sayılar:** "9.8 milyar USD sipariş bakiyesi" (sektör medyanı 2.1B), "%27 yıllık gelir büyümesi", "%3.29 AR-GE/ciro oranı", "%39.77 BIST 100'ü geçen 90-günlük performans". Bu rakamlar savunma sanayi narrasyonuyla tutarlı.
- **Devil's Advocate dengeli:** `overall_critique_strength=55/100` → orta düzey karşı argüman. Technical Pushback (MACD -4.08), Fundamental Pushback (EBITDA %18.4 vs sektör %22), Cross-Cutting Risks (USD revenue %13.71 partial hedge), Base Rate Warning (Defense squad geçmiş başarı %50) — dört eksenden de baskı uygulamış.
- **Tarihsel Bağlam canlı:** Memory'den 2025-07-08 ASELS tezi (9.6B backlog, %19.3 getiri, `correct`) inject edilmiş; mevcut 9.8B ile devamlılık vurgusu yapılmış.
- **Bull/Bear simetri:** 6/6, her iki tarafa eşit ağırlık.

**Zayıf yönler:**

- **Bull #5 kaynaksız** (`call_id: None`): "*Uzun vadeli trend bullish olarak belirlenmiştir ve golden cross formasyonu yaklaşıyor.*" — Teknik bir iddia ama call_id yok. Technical Worker output'una eklenmeyen LLM yorumu. Score 4 ile düşük tutulmuş (sistem farkında), ama citation validator bunu kaynaksız olarak yakalamış, yine de tez içine girmiş. Bu, **synthesizer'ın "low-score unsourced bullet'ları otomatik düşürmesi"** için bir iyileştirme noktası.
- **News/Macro alt-skoru çok düşük (27.5):** Tezin makro bölümünde sadece "BIST 100 %0.20 yükseliş, sentiment negatif" iddiası var; haber akışı zenginleştirilmemiş. Macro Context ajanı 41 satır — minimum implementasyon. Genişletme açık.
- **Peer comparison yok:** Sektör medyanı atıfları var (2.1B backlog, %22 EBITDA medyan), ama hangi peer'lerle? Havelsan, Roketsan, FORTE? Sektör medyanı bir black-box rakam olarak duruyor.
- **Tarihsel Bağlam'da self-referential pending tez:** "2026-05-16 tarihli bir başka ASELS tezi henüz sonuçlanmamış (pending)" — aynı gün önceki çalıştırma memory'ye sızmış. Bu test/demo gürültüsü; production'da pending tezlerin similarity sonuçlarına dahil edilmemesi düşünülebilir.

**Halüsinasyon riski:** Düşük. Sayılar tutarlı, tarihler 2026 ortasıyla uyumlu, sektör narrasyonu doğru.

### 2.2 MEPET_default — Confidence 52.44/100 ⚠️ Yapı Tutarlı, Veri Tartışmalı

**Squad:** Generic (**YANLIŞ** — sector_map'te Energy olmalı) · **Thesis MD:** 5 629 karakter · **Citation oranı:** 14/18 (78%).

**Güçlü yönler:**

- Format tutarlı, Bull/Bear oran 5/5.
- Devil's Advocate `overall_critique_strength=75/100` → güçlü karşı argüman, devil_inverse=25 ile final confidence'ı haklı olarak aşağı çekmiş.
- Brent korelasyonu Catalyst'te yer almış: "*son 30 günde %9.93'lük artışın devamı veya tersine dönmesi*" — petrol sektörü için doğru reflex.

**Zayıf yönler:**

- **"Ölüm kesişimi" abartısı:** TL;DR'de, Bear #2'de ve Risk Uyarıları'nda üç kez geçiyor; oysa MACD histogram **-0.01** ile sıfıra çok yakın. Aynı tezin Bull #5'inde de "*MACD histogramının -0.01 seviyesinde sıfıra yakın negatif olması, düşüş momentumunun zayıfladığını*" diyor — yani aynı veri hem "ölüm kesişimi yaklaşması" (bear) hem "momentum zayıflıyor, toparlanma potansiyeli" (bull) olarak yorumlanıyor. **İçsel çelişki.** Synthesizer prompt'unda "aynı göstergenin zıt yorumlarını işaretleme" hint'i eklenebilir.
- **Bear #5 ham itiraf:** "*Şirketin temel finansal verileri (2025 LTM gelirleri, EBITDA) gelecek döneme ait projeksiyonlara dayanmaktadır.*" — Yani sistem kendi tezinde "veriler projeksiyon olabilir" deyip aynı verilere göre tez kuruyor. Bu özgüvenli görünmüyor; veri tazeliği problemi explicit.
- **Devil's Advocate'te tezde olmayan iddia:** Devil's "İş Modeli Diversifikasyonu" başlığında "*Şirketin gayrimenkul ve inşaat faaliyetlerine yönelik stratejik iş birliği arayışları*" diyor — ama tezin ana metninde hiç bahsedilmiyor. Bu, devil ajanın tool çağrılarında ana akışın görmediği bir KAP duyurusuna ulaştığını gösteriyor: **bilgi sızıntısı/asimetri** — kontekstin tüm ajanlara consistent şekilde dağıtılmadığına işaret.
- **Generic squad → metric prompt eksik:** `agents/prompts/fundamental_energy.md` kullanılmadığı için `refining_margin`, `brent_korelasyon`, `EPDK_tarife` metrikleri tezde yok; sadece P/E, ROE, EBITDA gibi generic veriler var.

**Halüsinasyon riski:** Orta. Sayılar (P/E 10.2, ROE %14.5, EBITDA %15.2) tek başına makul ama (2.3'te göreceğimiz gibi) ikinci üretimle çelişiyor.

### 2.3 MEPET_default0 — Confidence 56.40/100 🔴 ANA UYARI: VERİ ÇELİŞKİSİ

**Squad:** Generic (**yine yanlış**) · **Thesis MD:** 5 461 karakter · **Citation oranı:** 17/19 (89%, en yüksek).

**Aynı şirket, ikinci üretim — temel finansal veriler:**

| Metrik | `MEPET_default` | `MEPET_default0` | Sapma |
|--------|-----------------|-------------------|-------|
| ROE | %14.5 | **%6.01** | -8.5 puan |
| Net kar marjı | %8.1 | **%4.17** | -3.93 puan |
| EBITDA marjı | %15.2 | **%11.42** | -3.78 puan |
| Borç/Özkaynak | 0.7 | **0.15** | -0.55 puan |
| Cari oran | 1.6 | 1.65 | ≈ aynı |
| Hisse fiyatı | 21.5 TL | 21.5 TL | aynı |
| RSI | 36.06 | 36.06 | aynı |
| 20-gün SMA | 22.93 | 22.93 | aynı |
| MACD histogram | -0.01 | -0.0095 | ≈ aynı |
| BIST göreceli | %-14.13 | %-14.13 | aynı |
| Temettü | (bahsedilmedi) | son 2015 | **default0 yeni** |

**Gözlem:** **Teknik göstergeler tıpatıp aynı** (yfinance veri kaynağı stabil), **temel finansal göstergeler ise dramatik farklı**. Bu, yfinance/pandas-ta tarafının deterministik, ancak **fundamental data provider chain'inin ya stale-cache hit'inden ya da iki ayrı kaynaktan (örn. isyatirimhisse vs. fixture) farklı snapshot çektiğine işaret ediyor.**

**Root Cause Hipotezleri (öncelik sırası):**

1. **Hipotez A — Fundamental provider chain'de cache miss/hit sapması:** Bir çalıştırma `isyatirimhisse` (taze veri) hit etmiş, diğeri fixture fallback'e düşmüş. `app/data/providers/` zinciri loglarda hangi provider'ın hit ettiğini söylüyor olmalı; iki çalıştırmanın `tool_call_logs` kayıtları karşılaştırılırsa kanıtlanabilir.
2. **Hipotez B — LLM yorumlama serbestliği:** Fundamental Worker prompt'u "Generic" squad'da metric mapping olmadığından, Gemini Flash ham finansal tabloyu kendi yorumuyla özetliyor; aynı tablodan farklı ROE/Net marj çıkarımı (örn. son LTM vs son fiscal year). **default0'daki "önceki zararlardan toparlanma, son LTM net kar 163.3M TL" cümlesi, default'taki "ROE %14.5" hesabıyla aynı şirkete ait gibi durmuyor.**
3. **Hipotez C — Veri kaynağı tarih farkı:** İki çalıştırma arasında MKK/KAP filing güncellenmiş olabilir. Ama ASELS'in `default` versiyonu da aynı gün üretilmiş ve `Tarihsel Bağlam`'da `2026-05-16T14:22:52` self-reference var; tarih farkı dakikalar düzeyinde — fiscal filing değişmiş olamaz.

**En olası neden A+B karışımı:** Provider chain'de cache TTL window'una göre farklı kaynak çekiyor, ve Generic squad prompt'u Gemini'ye fazla yorum hakkı tanıyor. **Eğer Energy squad'a düşseydi (`fundamental_energy.md` prompt'u + tanımlı metric set), iki çalıştırma metriklerinin aynı isimle, aynı kaynak referansıyla gelmesi beklenirdi.**

**Demo riski:** Jüri ya da izleyici aynı ticker'ı 2× çalıştırırsa farklı sayılar görür → güvenilirlik şüphesi doğar. **Bunu sunumda öne çıkarmadan, run-once-cache stratejisiyle (24 h cache) maskelemek mümkün.**

**default0'ın bağımsız kalitesi:**

- Yapı sağlam, citation oranı 89% (en yüksek).
- Temettü riski explicit ele alınmış: "*son 5 yılda düzenli temettü ödemesi bulunmamaktadır (en son 2015)*" — yatırımcı için kritik bir negatif.
- Peer eksikliğini explicit kabul etmiş: "*Sektörde karşılaştırılabilecek doğrudan bir peer bulunmadığından, şirketin sektördeki göreceli pozisyonu hakkında yorum yapılamamaktadır.*" Bu dürüst bir şeffaflık ama Energy squad düşseydi TUPRS/AKSEN/AYGAZ gibi peer'ler otomatik karşılaştırma için elde olurdu.
- Confidence breakdown anomalisi: `technical=1.0` — neredeyse hiç. Oysa 6 Bear noktasının 3'ü teknik (RSI, MACD, SMA). Skor hesabı (`agents/confidence.py`) ile tez içeriği uyumsuz; muhtemelen technical_worker'ın `momentum_score` post-processor'u Generic squad'a düştüğünde özel bir formül uyguluyor.

### 2.4 THYAO_default — Confidence 56.00/100 ⚠️ Sektör Uyumu İyi, Squad Yanlış

**Squad:** Generic (**YANLIŞ** — sector_map.yaml'da `Transportation`) · **Thesis MD:** 5 572 karakter · **Citation oranı:** 16/20 (80%).

**Güçlü yönler:**

- **Havacılık dinamikleri yerinde:** Brent risk explicit (Bear #6, Risk #5, Catalyst #3), %40 politika faizi → borçlanma maliyeti baskısı (Bear #5, Risk #2), seyahat talebi toparlanması (Catalyst #2).
- **Likidite uyarısı doğru tespit edilmiş:** Cari oran 0.97 → "1'in altında" → "kısa vadeli yükümlülükleri yerine getirme zorluğu" (Bear #4, Risk #3). Bu havacılık sektörü için sezonsal nakit akışıyla birlikte ciddi bir gözlem.
- **Yüksek kaldıraç (D/E 1.23):** Bull case'lerden hiç saklanmamış; Bear #5'te öne çıkmış.

**Zayıf yönler:**

- **Generic squad → operasyonel KPI eksik:** Transportation squad metrikleri (`yolcu_yuk_sayisi`, `kapasite_kullanim`, `yakit_maliyeti`, `doluluk_orani`, `birim_gelir`) tezde yok. Sadece klasik P/L (gelir, ROE, EBITDA) tartışılmış. Havayolu yatırımcısı bu tezi okuyup "Load Factor neydi?" diye sorar — cevap yok.
- **%45.9 yıllık gelir büyümesi (Bull #1) saçma değil ama bağlamı eksik:** Bu büyüme TL bazında, **enflasyon etkisi temizlenmemiş**. Türkiye'de 2025-2026 enflasyonu yıllık %35-40 aralığında. Reel büyüme muhtemelen tek haneli ya da negatif. Tezde bu ayrım yapılmamış → yanıltıcı bir bull sinyali.
- **Catalyst #4'teki "Merkez Bankası politika faizinde olası indirimler" tüm hisseler için geçerli:** Havayoluna özel bir katalist değil; tez customization eksikliği.
- **Devil's Advocate'te "Tercih listesinden çıkarıldı" haberi kaynaksız:** Cross-Cutting Risks'te "*Jeopolitik riskler THYAO'yu etkiliyor: Tercih listesinden çıkarıldı haberi*" diye geçiyor — ama hangi havayolu birliği? Hangi kaynak? Bu **halüsinasyon flag'i**. Production'da hardcoded benzer iddialar için validator pattern eklenmeli.
- **ATR 7.86 yorumu yüzeysel (Bull #5):** "*kısa vadede aşırı volatilite riskinin düşük olduğunu gösteriyor*" — ATR mutlak değer; 300 TL üzerinde 7.86 → %2.6 günlük volatilite, havacılık sektörü için **yüksek**. Yorum ters dönmüş.

**Halüsinasyon riski:** Orta. Ana finansal veriler (gelir 1.13 trilyon TL, EBITDA 211.74 milyar TL) THYAO'nun gerçek 2026 Q1 raporlarıyla denetlenmemiş — ama sayılar büyüklük olarak makul. "Tercih listesinden çıkarıldı" haberi audit edilmesi gereken bir flag.

### 2.5 Tezlerin Kesişen Sistematik Sorunları

| Sorun | Etki | Önerilen Düzeltme |
|-------|------|-------------------|
| **Sektör yönlendirme kayıpları (MEPET, THYAO → Generic)** | Squad-spesifik metrik & prompt kullanılmıyor; tezin "5+1 squad" değer önerisi gerçekleşmiyor | `sector_router.py` ile güncel `sector_map.yaml`'ın senkronize olduğunu doğrula; tezleri yeniden üret |
| **Peer comparison hiçbir tezde yok** | Sektör medyanı atıfları black-box; karşılaştırma yapılamıyor | Synthesizer prompt'una "her squad için top-3 peer'in karşılaştırma tablosu" zorunluluğu ekle; tool olarak `fetch_squad_peers(ticker, top_k=3)` sun |
| **Catalyst'lerin çoğu kaynaksız (`call_id: None`)** | Sistemin "citation-grounded" iddiası zayıflıyor; jüri sorgu sorabilir | Catalyst üretiminin tool-call zorunluluğunu validator'a ekle; tool yoksa catalyst düşür |
| **Tarihsel Bağlam memory pool audit edilmemiş** | ASELS 2025-07-08 %19.3 getiri claim'i kanıtlanmadı | `scripts/audit_memory.py` yaz: her `outcome=correct` kaydını gerçek BIST tarihsel veri ile karşılaştır |
| **Aynı veriden zıt yorum (MEPET ölüm kesişimi / toparlanma)** | İçsel tutarsızlık | Synthesizer post-process: "aynı call_id farklı yönde 2× kullanılırsa flag" |
| **Confidence breakdown'ın tez içeriğiyle uyumsuzluğu** (MEPET0: technical=1 ama 3 teknik bear var; THYAO: technical=5 benzer durum) | Skor güvenilirliği zayıflıyor | `confidence.py` momentum_score formülünü Generic squad için ayrı kalibre et |
| **`Bull #5` örneklerinde score=4 ve kaynaksız bullet tezde** | Düşük skorlu kaynaksız iddialar bile MD'ye giriyor | Synthesizer prompt'unda `score < 6 ve call_id=None ise düşür` kuralı |
| **Enflasyon etkisi temizlenmemiş** (THYAO %45.9 büyüme) | Reel/nominal ayrımı yapılmıyor; yanıltıcı | Macro Context'ten CPI inject + Synthesizer'a "TL gelirlerinde nominal vs reel ayrımı yap" hint'i |

---

## 3. Test ve Kalite Altyapısı

### 3.1 Mevcut Testler

| Tip | Konum | Dosya | Satır |
|-----|-------|-------|-------|
| Unit | `backend/tests/unit/` | 7 dosya (citation_validator, data_chain, memory_agent, repo, synthesizer, tool_decorator, workers) | ~ |
| Integration | `backend/tests/integration/` | 2 dosya (orchestrator end-to-end mock LLM, api endpoints) | ~ |
| Smoke | `backend/scripts/` | smoke_demo.py, smoke_test.py, backtest.py | ~ |

**Smoke test sonucu (`demo_smoke_results.json`, 2026-05-17 00:01):**

| Ticker | OK | Duration (s) | Confidence | Bull/Bear |
|--------|----|---------------:|-----------:|----------:|
| ASELS  | ✅ | 94.49 | 66.81 | 5/5 |
| GARAN  | ✅ | 108.22 | 46.97 | 4/5 |
| TUPRS  | ✅ | 97.08 | 62.91 | 5/6 |
| MGROS  | ✅ | 93.40 | 64.01 | 5/5 |
| EREGL  | ✅ | 109.78 | 60.16 | 6/6 |

5/5 yeşil, ortalama ~100 s, **`had_kaynaksiz_flag=false`** (sert kaynaksız claim yok).

### 3.2 Eksiklikler

| Eksik | Etki | Aciliyet |
|-------|------|----------|
| `.github/workflows/` yok | PR ve nightly otomasyon yok | 🟡 P2 |
| Coverage raporu üretilmemiş | `pytest --cov` config var ama çağrılmıyor | 🟡 P2 |
| Conservative mode smoke testi yok | `user_mode="conservative"` canlı E2E doğrulanmamış | 🔴 P0 (demo öncesi) |
| `pyproject.toml`'da ruff/mypy/black config yok | Code style gevşek | 🟢 P3 |
| `.pre-commit-config.yaml` yok | Style enforcement yok | 🟢 P3 |
| Token usage metriği export edilmiyor | Maliyet izleme manuel | 🟢 P3 |

### 3.3 Backtest Scripts

`scripts/backtest.py` (son commit `d5be43c`): Confidence bucket'larını gerçek getiri ile korele eder, `docs/backtest_report.json` üretir. v2'de tam ajan olarak entegre edilecek. Mevcut hali "deterministic pattern observation" — yani sistem deterministik üretmediği durumlarda flag'liyor. Bu **MEPET veri çelişkisini otomatik yakalamış mı?** kontrol edilmeli; eğer evet, mekanizma çalışıyor; eğer hayır, threshold çok gevşek.

---

## 4. Dokümantasyon Durumu

### 4.1 Mevcut

`docs/` klasöründe 17 dosya tespit edildi:

| Dosya | Amaç | Durum |
|-------|------|-------|
| `agents.md` | 8 ajan detayı + squad + citation | ✅ |
| `architecture.md` | 4-katman mimari + DAG | ✅ |
| `BACKEND_ANALIZ_RAPORU.md` | Bir önceki backend analizi | ℹ️ Bu rapor onun yerine kullanılabilir |
| `backend-progress-report.md` | Sprint ilerleme notu | ℹ️ |
| `backtest_report.json` | Backtest çıktısı | ✅ |
| `data.md`, `database.md`, `database-detailed.md` | Veri ve şema | ✅ |
| `demo.md` | 3 demo senaryosu (default/conservative/memory) | ✅ |
| `flows.md` | Sequence diagram + cache + kill-switch | ✅ |
| `implementation-spec.md` | Spec | ✅ |
| `product.md`, `risks.md`, `roadmap.md` | Ürün + risk + v2 yol haritası | ✅ |
| `sprint.md` | 7 günlük plan | ✅ |
| `stack.md` | Tech stack + deploy | ✅ |
| `testing.md` | Test stratejisi | ✅ |

`backend/TESTING.md` (334 satır) **manuel test rehberi** — adım-adım kurulum, curl örnekleri, WS event sözlüğü, sorun giderme tablosu. Yeni gelen 30 dakikada smoke koşturabilir.

`README.md` kısa, demo-odaklı. Yeterli.

### 4.2 Eksikler

- **OpenAPI/Swagger:** FastAPI default'ta `/docs` açık ama sunumda görsel rehber olarak gösterilmemiş; jüri sorgu sorabilir → demo senaryosuna ekle (zaten ücretsiz).
- **Mimari diyagram (görsel):** `docs/flows.md` ASCII sequence verir ama PNG/SVG yok. Slayt için çizilmeli.
- **Demo video script** var (`docs/demo.md`), **kayıt yok**.
- **Sunum slaytları yok.**

---

## 5. Eksik Özellikler ve Riskler — Eyleme Geçirilebilir Liste

### 5.1 🔴 P0 — Demo öncesi mutlaka (24-48 saat)

| # | Görev | Kim | Tahmini süre |
|---|-------|-----|--------------:|
| 1 | **MEPET veri çelişkisi RCA:** `tool_call_logs` tablosundan iki üretimin provider chain hit'lerini ve fundamental_worker prompt fingerprint'lerini karşılaştır. Bulguya göre ya cache TTL'i sıkılaştır ya da Generic squad fundamental prompt'una "rakam tablosunu olduğu gibi alıntıla, yeniden hesaplama yapma" hint'i ekle. | A | 3-4 sa |
| 2 | **Sector router fix:** `sector_router.py` ve `sector_map.py`'nin güncel `backend/sector_map.yaml`'ı okuduğunu doğrula. MEPET/THYAO için tekrar üretim yap → squad'ın `Energy`/`Transportation` olarak düştüğünü teyit et. Yeni tezleri staged dosyaların üzerine yaz. | A | 2 sa |
| 3 | **Conservative mode smoke test:** `python scripts/smoke_test.py ASELS conservative` ve `TUPRS conservative` çalıştır; `applied_cap=70` doğrula. | A | 1 sa |
| 4 | **`feature/frontend` → `develop` merge:** Conflict çözümü + E2E smoke (live thesis runner → token stream → final viewer). | C | 4-6 sa |
| 5 | **Demo video kaydı (3 senaryo):** Mehmet default, Ali Bey conservative, ASELS memory similarity. 3-5 dk Türkçe voiceover. | C | 3 sa |
| 6 | **Sunum slaytları (15-20 slide):** Problem → mimari → 8 ajan komite → citation-grounded güvenlik → canlı demo (3 senaryo) → memory differential → finansal model → v2. | A+B+C | 4-6 sa |
| 7 | **Pre-warm cache populate:** `scripts/warmup.py` çağır, 10 hisse (ASELS/GARAN/TUPRS/BIMAS/EREGL/THYAO/AKBNK/KCHOL/SISE/ULKER) tüm tool sonuçlarını cache'e bas. | B | 1 sa |
| 8 | **Prod deploy test:** Railway/Supabase/Upstash hesapları aç, `docker compose -f prod.yml up` smoke. Demo gününde fallback olarak local da hazır olsun. | B | 4 sa |
| 9 | **Staged thesis_output_*.md temizliği:** Ya commit et (`docs/samples/` altına taşıyarak), ya da `.gitignore`'a `thesis_output_*.md` ekle. Şu an dağınık repo state'i. | A | 15 dk |

### 5.2 🟡 P1 — Hackathon süresi içinde mümkünse

1. **Synthesizer prompt'una "peer comparison zorunluluğu":** Her squad için top-3 peer otomatik karşılaştırma tablosu. ROI yüksek — tez kalitesi belirgin artar.
2. **Catalyst kaynaksızlık fix:** Validator'a "catalyst.call_id zorunlu" kuralı; tool çağrısı olmadan üretilen catalyst'leri düşür ya da `[varsayım]` etiketi koy.
3. **Halüsinasyon detection:** Aynı ticker için 2 üretim arasında metrik divergence > %20 ise alert; `scripts/regression_check.py` ekle.
4. **OpenAPI Swagger UI expose:** FastAPI'de zaten built-in, `/docs` route'unu README + demo akışına dahil et.
5. **Memory pool audit:** `outcome=correct` etiketli her kaydı gerçek BIST tarihsel getirisiyle çapraz doğrula.

### 5.3 🟢 P2 — Hackathon sonrası

1. CI/CD GitHub Actions YAML (PR unit + nightly smoke).
2. OpenTelemetry trace export (Strands native).
3. Prometheus/Grafana metrik (token usage, latency dist, provider fallback rate).
4. ruff + mypy + black + pre-commit config.
5. Sentiment Worker (Reddit r/borsa + Ekşi feed).
6. Backtest Validator Agent (as-of-date ground truth feedback loop).
7. Redis pub/sub WS hub (multi-worker scale).

---

## 6. Bağımlılıklar ve Kurulum

`backend/pyproject.toml` özet:

- **LLM:** `strands-agents[gemini]>=1.39`, `google-genai>=1.0`
- **Veri:** `yfinance>=0.2.60`, `isyatirimhisse>=5.0.1`, `pandas-ta>=0.4.67b0`, `borsapy`
- **DB:** `sqlalchemy[asyncio]>=2.0.30`, `asyncpg>=0.29`, `pgvector>=0.3`, `alembic>=1.13`
- **Web:** `fastapi>=0.115`, `websockets>=12`, `uvicorn`
- **Test:** `pytest>=8.2`, `pytest-asyncio>=0.23`, `pytest-cov>=5.0`, `respx`

`.env.example` mevcut (`GEMINI_API_KEY`, `DATABASE_URL`, `TCMB_EVDS_KEY`, MKK creds, rate limits). `docker-compose.yml` postgres+pgvector + pgbouncer container'larıyla hazır.

**Eksik:** `.env.example` içinde frontend için NEXT_PUBLIC_API_URL benzeri değişkenler yok (frontend henüz merge edilmediği için).

---

## 7. Logging ve Observability

- **structlog** JSON formatında (`app/core/logging.py`): event, ticker, agent_id, call_id, latency_ms.
- **Event stream:** `agent_start`/`stage`/`token`/`critique`/`done`/`error`.
- **Exception hierarchy:** `DataUnavailable`, `ProviderError`, citation soft flag `[KAYNAKSIZ]`.
- **OTel:** spec'te var (`docs/testing.md` §4.1), implementasyon yok — v2.
- **Metrikler:** Tanımlı (`thesis.generation_duration_seconds`, `tool.call.count`, `citation.kaynaksiz_count`, `gemini.tokens_used`, `provider.fallback.count`) ama Prometheus exporter yok.

Demo için yeterli; production için OTel + Prometheus eklenmeli.

---

## 8. Hackathon Hazırlık Skorkartı

| Kategori | Skor | Detay |
|----------|-----:|-------|
| Test Kapsamı | 5.8/10 | Unit/integration/smoke ✅; CI/CD ❌; coverage rapor ❌; conservative E2E ❌ |
| Dokümantasyon | 9.0/10 | 17 docs + TESTING.md + README ✅; Swagger expose ❌; mimari görsel ❌ |
| Özellik Tamamlığı | 7.0/10 | 8 ajan ✅; Memory ✅; Conservative ✅; sector routing tezlerde başarısız ⚠️; sentiment/backtest v2 |
| Kurulum / Bağımlılıklar | 9.0/10 | Pinned, docker-compose, .env.example ✅; frontend env eksik |
| Logging / Observability | 8.0/10 | structlog + event stream ✅; OTel + Prometheus v2 |
| Performans / Maliyet | 7.5/10 | Cache + rate limit + retry ✅; pre-warm populate eksik; token metrik export ❌ |
| Teslim Hazırlığı | 6.5/10 | Demo akışı yazılı ✅; **video ❌; slaytlar ❌; prod deploy ❌; frontend merge ❌** |
| Kod Kalitesi | 7.5/10 | Type hints yaygın ✅; linter/pre-commit ❌; TODO/FIXME 0 satır ✅ |
| **Genel** | **7.9/10** | 🟢 **MVP → Demo-Ready, üç P0 ile teslim-ready** |

---

## 9. Sonuç ve Tavsiye

ThesisForge **mimari olarak sağlam, dokümante edilmiş, hackathon prototipinin üzerinde bir MVP**'dir. 8 ajan + 12-adımlı DAG + citation validator + memory inject çalışıyor; smoke test 5/5 yeşil; backend kod tabanı 3 187 satır agent-katmanında, manageable ve audit edilebilir.

Ancak **demo öncesi üç P0 kapatılmadan sahaya çıkmamalı:**

1. **MEPET veri çelişkisini araştır ve ya kök sebebi düzelt ya da run-once-cache stratejisiyle maskele.**
2. **Sector router'ı çalıştığını doğrula:** Tezler güncel `sector_map.yaml` ile yeniden üretilmeli; jüriye "petrol şirketi Generic squad'a düşüyor" sorusu cevap verilemez.
3. **Demo paketini tamamla:** frontend merge, video kayıt, slaytlar, prod deploy.

Bu üç madde 24-48 saatte kapatılabilir. Kapatıldığında ürün, jüri önünde rahatlıkla canlı demo edilebilir; bonuslar (peer comparison, halüsinasyon detection, CI/CD) hackathon sonrasına yetiştirilebilir.

**Yarın için tek odak öneri:** A → MEPET RCA + sector router fix; B → pre-warm cache + prod deploy; C → frontend merge + demo video. Akşam 3'ü bir araya getirip slayt taslağı.

---

> **Disclaimer:** Bu rapor 2026-05-17 tarihindeki repo durumuna dayanır (branş `develop`, commit `d5be43c`). Tezlerin finansal yorumları üretilen MD dosyalarından alıntıdır; gerçek BIST verisi ile çapraz doğrulanmamıştır. Memory pool'daki tarihsel `outcome=correct` etiketleri audit edilmemiş; bu raporun §2.5 önerilen "memory audit" görevi tamamlandıktan sonra güvenilir kabul edilebilir.
