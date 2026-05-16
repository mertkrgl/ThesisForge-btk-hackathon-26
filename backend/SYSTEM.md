# ThesisForge Backend — Sistemin Nasıl Çalıştığı

Bu doküman uçtan uca pipeline'ın **ne yaptığını**, **kaynaksız flag** mekaniğinin
ayrıntılarını ve `run.sh` ile **kendi terminalinden** nasıl koşulacağını anlatır.
Ortam kurulumu (`.env`, Docker, API anahtarları) için `TESTING.md`'ye bak —
burada onu tekrar etmiyoruz.

---

## 1. Sistem ne yapar?

Bir BIST hissesi (örn. `TUPRS`) verirsin; sistem **çok-ajanlı bir komite**
çalıştırıp Türkçe, kaynaklı bir yatırım tezi üretir:

- 5-7 maddelik **Bull Case** + **Bear Case**
- 2-4 maddelik **Anahtar Katalizörler** (tarihli)
- Sektör bağlamı, devil's advocate eleştirisi, risk uyarıları
- 0-100 arası **final güven skoru** (bileşen breakdown'lu)
- Her sayısal claim için `[kaynak: <uuid>]` etiketi → arkada gerçek tool
  çağrısı log'una bağlı

Çıktı hem DB'ye yazılır hem de WebSocket üzerinden chunk-chunk stream edilir.

---

## 2. Pipeline akışı (orchestrator)

`backend/app/agents/orchestrator.py` 12 adımı sırayla koordine eder:

```
1. create_thesis_skeleton(ticker)              → thesis_id (DB INSERT)

2. PARALLEL (asyncio.gather, izole session):
   ├─ sector_router       → ticker'ı 17 squad + Generic fallback içinden birine ata (sector_map.yaml)
   ├─ macro_context       → USD/TRY, TÜFE, politika faizi, XU100, Brent
   └─ memory_agent        → geçmişten benzer tezleri çek (top_k=3, embedding similarity)

3. PARALLEL (squad belli olduktan sonra):
   ├─ technical_worker    → RSI, MACD, SMA/EMA, Bollinger, support/resistance, momentum_score
   └─ fundamental_worker  → squad-spesifik 6 tool: KAP, financial_statements, ratios,
                             peers, peer_compare, dividend_history

4. devils_advocate        → bull tezini ters köşeye yatırır: technical/fundamental
                             pushback, cross-cutting risks, base-rate uyarıları,
                             overall_critique_strength (0-100)

5. data_quality           → (başarılı tool call / toplam tool call) × 100

6. compute_confidence(...) → ağırlıklı bileşik (bakınız §4)

7. synthesizer (Pro/Flash) → tek bir Türkçe markdown tezi yazar; NO tools.
                              Sadece yukarıdaki bağlamı kullanır, observation
                              listesindeki UUID'leri `[kaynak: ...]` etiketine
                              gömer.

8. validate_citations      → 3-katmanlı doğrulama (bakınız §3); başarısızsa
                              synthesizer'a **1 kez** retry feedback gönderir.

9. extract_structured      → markdown'dan bull_points/bear_points/catalysts
                              listelerini schema'lı çıkarır (Flash).

10. update_thesis_synthesis → DB'ye persist (theses tablosu).

11. write_thesis_embedding (fire-and-forget) → memory havuzuna embed edilir;
                              gelecek tezlerde "Tarihsel Bağlam" için aranır.

12. websocket_emit          → final markdown 60 karakterlik chunk'larla
                              UI'ye yollanır (`"yazılıyor"` hissi).
```

Üst seviye watchdog: `timeout_sec=120s`. Her ajanın kendi `try/except` fallback'i
var; biri çökse bile pipeline ayakta kalır, eksik bölümle devam eder.

---

## 3. Kaynaksız (citation) sistemi

### 3.1. Sözleşme

Synthesizer'ın yazdığı **her sayısal/aktarılan claim** sonunda
`[kaynak: <UUID>]` etiketi bulunmak zorundadır. UUID, workers'ın
(`technical_worker` ve `fundamental_worker`) gerçekten çağırdığı bir tool'un
log kaydına (`tool_call_logs.call_id`) işaret eder.

Worker observation havuzu run başına ~10-14 UUID içerir. Synthesizer
**UUID uydurmaz** — eşleştiremezse claim'i `[kaynak:]` etiketsiz yazar.

### 3.2. 3-katmanlı validator

`backend/app/citations/validator.py` her tez için sırayla:

| # | Katman | Ne yapar | Başarısızsa |
|---|---|---|---|
| 1 | **Regex parse** | `[kaynak: <uuid>]` etiketlerini regex ile çek | — (sadece ekstraksiyon) |
| 2 | **PK lookup** | Her UUID `tool_call_logs` tablosunda gerçekten var mı (ve aynı thesis_id'ye bağlı mı)? | UUID **invalid** sayılır |
| 3 | **Numeric sanity** | Etiketten ÖNCEKİ cümledeki sayılar tool sonucunda (JSON içinde) geçiyor mu? | UUID için **numeric_issue** log'a yazılır ama kaynaklılığı bozmaz |

Validator katman 1+2'de hata bulursa synthesizer'a feedback'le bir kez retry
çağırır. Hâlâ tutmuyorsa kaynaksız claim sayılır.

### 3.3. `had_kaynaksiz_flag` ne zaman yanar?

Tez DB'ye kaydedilirken `theses.had_kaynaksiz_flag` set edilir, bayrak
**`True` ise "düşük kaliteli rapor"** sinyali demektir. UI tarafında bunu
göstermek isteyebilirsin (örn. confidence skorunun yanında uyarı badge).

Kural (bilinçli olarak dar tutuldu):

```
had_kaynaksiz = (
    Bir BULLET satırı &&                         # paragraf cümleleri sayılmaz
    [kaynak: ...] etiketi yok VEYA invalid &&    # PK lookup başarısız
    Bullet metni FINANSAL SAYI içeriyor          # %, TL/USD, milyar/milyon, x, ondalık
)
```

Yani:

- ✅ **Tetikler** — `- Cari oran 1.07, sektör medyanı 1.4'ün altında.` (kaynak yok)
- ❌ Tetiklemez — `- Jeopolitik riskler operasyonları etkileyebilir.` (sayı yok)
- ❌ Tetiklemez — `## TL;DR\nGARAN için temkinli bir tez...` (bullet değil)
- ❌ Tetiklemez — `- 2026-Q3: Yeni analist raporları` (Catalyst tarihi sayı değil)
- ❌ Tetiklemez — `Bu içerik bilgi amaçlıdır.` (Disclaimer paragrafı)

Bu daraltma, eski versiyondaki false-positive sorununu çözer: önceden Disclaimer
paragrafı veya soyut risk maddesi her tezde bayrağı kaldırıyordu, gerçek
"sayı uyduran" claim'ler ise gürültüye karışıyordu.

`_FACTUAL_NUMBER_RE` regex'i şunları finansal sayı sayar:

| Pattern | Örnek |
|---|---|
| `%X` | %15, %2.4 |
| Para birimi | 100 TL, 5 USD, 258 ₺ |
| Büyüklük | 5 milyar, 800 bin |
| Çarpan | 1.5x, 12.3x |
| Baz puan | 50 bp, 30 baz puan |
| Ondalık | 1.47, 39.97 |

**Numeric sanity (katman 3) flag tetiklemez** — sadece log'a yazılır.
Türetilmiş metrikler (kar marjı, peer farkı, YoY büyüme %) tool JSON'ında
birebir geçmiyor; aksi takdirde her tez yanlış-pozitifle dolardı. Halüsinasyon
koruması katman 2 (PK lookup) ile sürer.

### 3.4. Audit edebilmek için

Tez tamamlandıktan sonra:

```
GET /api/thesis/{id}/citations
```

döner:

```json
[
  {
    "claim_text": "RSI 42.19 seviyesinde...",
    "call_id": "7549cbac-dd5b-42f1-9c73-d3cbe71022e2",
    "tool_name": "compute_indicators",
    "tool_result": { ... ham tool JSON ... },
    "is_kaynaksiz": false
  },
  ...
]
```

UI'de tooltip olarak ham tool çıktısını gösterebilirsin → "Bu sayı nereden
geldi?" sorusunun tek tıklık cevabı.

---

## 4. Güven skoru (final confidence)

`backend/app/agents/confidence.py` — ağırlıklı toplam, 0-100:

| Bileşen | Ağırlık | Kaynağı |
|---|---|---|
| `data_quality` | 0.25 | `(başarılı tool / toplam tool) * 100` |
| `technical` | 0.20 | `technical_worker.momentum_score` |
| `fundamental` | 0.20 | `fundamental_worker.fundamental_score` |
| `news_macro` | 0.15 | macro paragraf üretildiyse 60, üretilmediyse 40 (baseline) |
| `memory_base` | 0.10 | memory_hits'teki "correct" oranı × 100; hit yoksa nötr 50 |
| `devil_inverse` | 0.10 | `100 - overall_critique_strength` (devil ne kadar güçlüyse skor o kadar düşer) |

**Conservative mod** (`user_mode="conservative"`) final ≤ **70**'e cap'lenir.
Cap uygulandıysa `confidence_breakdown.applied_cap = 70.0` olarak rapor edilir
ve synthesizer "Güven Skoru" bölümünde bunu açıkça yazmak zorundadır.

---

## 5. Squad sistemi

`backend/sector_map.yaml` ticker → squad eşleşmesi tutar. Squad seçilince
fundamental_worker o squad'ın özel prompt'unu yükler:

17 sektör squad'ı + Generic fallback. Toplam 893 BIST tickerı `mkk_companies.csv`'den otomatik kategorize edildi.

| Squad | Örnek tickerlar | Squad-spesifik metrikler |
|---|---|---|
| **Banking** | GARAN, AKBNK, ISCTR, YKBNK | NIM, CAR, NPL, CASA, ROE, cost_to_income |
| **Insurance** | AKGRT, ANSGR, AGESA, ANHYT | combined_ratio, loss_ratio, premium_growth, solvency_ratio |
| **Finance** | ALFIN, ATLFA, CRDFA, DENFA (faktoring, leasing, finansman) | NPL, kredi_buyume, fonlama_maliyeti, kaldirac |
| **Brokerage** | A1CAP, ISMEN, INFO, GEDIK (aracı kurum, PYS) | AUM, komisyon_geliri, islem_hacmi_payi, ROE |
| **RealEstate** | EKGYO, ISGYO, AKMGY, ALGYO | NAV_iskonto, portfoy_degeri, doluluk_orani |
| **Energy** | TUPRS, AKSEN, ENJSA, AYGAZ | refining_margin, brent_korelasyon, EBITDA, EPDK_tarife |
| **Defense** | ASELS, OTKAR, ALTNY, FORTE | backlog, R&D_oran, USD_revenue_pct |
| **Automotive** | FROTO, TOASO, OTKAR, DOAS, BRISA | uretim_adedi, ihracat_orani, kapasite_kullanim, EBITDA_margin |
| **Technology** | LOGO, ARDYZ, KAREL, NETAS, TCELL, TTKOM | ARR, gross_margin, R&D_oran, EBITDA_margin |
| **Healthcare** | MPARK, LKMNH, SELEC, ECILC, ECZYT | doluluk_orani, ihracat_orani, R&D_oran, EBITDA_margin |
| **Food** | ULKER, CCOLA, AEFES, BANVT, KENT | hacim_buyume, fiyat_etkisi, brut_kar_margin, pazar_payi |
| **Retail** | BIMAS, MGROS, SOKM, CRFSA, EBEBK | LFL_buyume, magaza_sayisi, SSS, gross_margin |
| **Construction** | AKCNS, BTCIM, CIMSA, NUHCM, ENKAI, SISE | satis_hizi, kapasite_kullanim, ihracat_orani, birim_marja |
| **Industrial** | EREGL, KRDMA, ISDMR, PETKM, ARCLK, KORDS | kapasite_kullanim, emtia_korelasyon, USD_revenue_pct, EBITDA_margin |
| **Mining** | KOZAA, KOZAL, MARBL, CVKMD | rezerv, AISC, altin_fiyat_korelasyon, EBITDA_margin |
| **Transportation** | THYAO, PGSUS, TAVHL, CLEBI, RYSAS | yolcu_sayisi, doluluk_orani, yakit_maliyeti, USD_revenue_pct |
| **Holding** | KCHOL, SAHOL, DOHOL, AGHOL, ALARK, BERA | NAV_iskonto, portfoy_dagilimi, temettu_geliri, borc_servis_orani |
| **Generic** | (eşleşmeyenler) | P/E, P/B, ROE, EBITDA, EV/EBITDA |

Squad prompt'ları (`backend/app/agents/prompts/fundamental_*.md`):
- Her zorunlu **6 tool** çağrısı (`fetch_kap_filings`, `get_financial_statements`,
  `compute_ratios`, `get_sector_peers`, `compare_to_peers`, `get_dividend_history`)
- **5-7 observation** üret (kaynaksız claim'i azaltmak için bol/spesifik tut)
- Eksik metrik için **"AYRI observation: bu veri tool çağrısında dönmedi"**
  yaz (synthesizer'ın panik yapmaması ve "Güven Skoru"nda data_quality
  düşüklüğünü açıklayabilmesi için)

---

## 6. `run.sh` ile uçtan uca koşma

### 6.1. Önkoşul (tek seferlik — sıfırdan kurulum)

> ⚠️ **`run.sh` sıfırdan kurmaz** — sadece "kurulu olan stack'i tetikler".
> Postgres container'ını ve uvicorn'u idempotent başlatır, ama venv,
> bağımlılıklar, `.env`, DB migration ve Docker daemon **senin sorumluluğunda**.
> Bunlardan biri eksikse aşağıdaki hatalardan birini alırsın:

| Eksik | Hata mesajı / belirti |
|---|---|
| Docker daemon kapalı | `Cannot connect to the Docker daemon` |
| Docker yok | `docker: command not found` |
| `backend/.venv` yok | `source: .venv/bin/activate: No such file or directory` |
| Bağımlılıklar kurulu değil | `uvicorn: command not found` |
| `backend/.env` yok / `GEMINI_API_KEY` boş | uvicorn ayakta ama her tez `_FALLBACK_MD` döner ("Sentez ajanı çalışamadı") |
| Alembic migration koşmamış | İlk `POST /chat` → `asyncpg.UndefinedTableError: relation "theses" does not exist` |
| Python < 3.11 | venv yaratma anında `requires-python` reddi |

**Sıfırdan başka bir PC'de tek seferlik sıralama:**

```bash
# 0. Sistem ön koşulları
#    - Python 3.11+ (3.12 tavsiye)
#    - Docker + Docker Compose
#    - Docker daemon çalışıyor: sudo systemctl start docker  (Linux)
#                                Docker Desktop açık         (Mac/Windows)

# 1. Repo
git clone <repo-url>
cd btk-hackathon'26

# 2. Backend venv + bağımlılıklar
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .

# 3. .env hazırla
cp .env.example .env
# nano .env  →  en azından şu alan dolu olmalı:
#   GEMINI_API_KEY=AIzaSy...
#   GEMINI_MODEL_PRO=gemini-2.5-flash       # free tier'da pro=0 quota
#   GEMINI_MODEL_FLASH=gemini-2.5-flash
# Detaylı .env şablonu için: backend/TESTING.md §2

# 4. Postgres'i ayağa kaldır (run.sh da yapar ama migration için ayrı tutmak daha kontrollü)
cd ..
docker compose up -d postgres

# 5. DB migration — KRİTİK, run.sh atlıyor
#    Postgres 'healthy' olana kadar bekle (~5-10s), sonra:
cd backend
source .venv/bin/activate
alembic upgrade head
#    → "theses", "tool_call_logs", "citations", "watchlist" tabloları oluşur

# 6. (Opsiyonel) fixture verisini yükle — offline test için
#    backend/fixtures/ altındaki JSON'ları kullanır;
#    THESISFORGE_MODE=fixture iken canlı API çağrısı yapmaz.

# 7. Hazırsın → repo köküne dön, run.sh tetikle
cd ..
./run.sh TUPRS
```

Yukarıdaki adımlar **bir kez** yapılır. Sonraki çağrılarda direkt `./run.sh
<TICKER> [MODE]` yeterli — `run.sh` postgres'i ve uvicorn'u kendisi
ayağa kaldırır.

> 💡 Ortam değişkenlerini değiştirdiysen (`.env` düzenlediysen) çalışan
> uvicorn'u durdurup yeniden başlatmalısın: `./run.sh --stop && ./run.sh TUPRS`.

Ortam dosyalarının (`.env`) içeriği ve API anahtarlarını nereden alacağın
için: **`backend/TESTING.md` §1-2**.

### 6.2. Komutlar

`run.sh` repo kökünde. **Her çalıştırma 3 işi sırayla yapar:**

1. `thesisforge-postgres` container'ı yoksa `docker compose up -d postgres`
2. `127.0.0.1:8000/health` cevap vermiyorsa uvicorn'u arka planda başlatır
   (log: `/tmp/thesisforge_uvicorn.log`, `nohup` + `disown`)
3. `python backend/scripts/run_thesis.py <TICKER> <MODE>` çağırır:
   - `POST /chat` ile pipeline'ı tetikler
   - WS event stream'i dinler (stage, critique, done)
   - `GET /api/thesis/{id}` + `GET /api/thesis/{id}/citations` ile sonucu çeker
   - Repo kökünde **`thesis_output_<TICKER>_<MODE>.md`** dosyasını yazar

### 6.3. Pratik kullanım

```bash
# ASELS / default (argümansız → ASELS default)
./run.sh

# Bir Energy hissesi
./run.sh TUPRS

# Conservative mod (final ≤ 70 cap)
./run.sh GARAN conservative

# Backend'i durdur (uvicorn + postgres)
./run.sh --stop
```

İlk çağrı uvicorn'u ayağa kaldırır (~5-15s); sonraki çağrılar `[ok] uvicorn
already up` ile saniyeler içinde başlar. Tipik bir tez **45-90s** sürer
(LLM RPM limit'lerine bağlı).

### 6.4. Konsol çıktısı

```
> ThesisForge runner  |  ticker=TUPRS  |  mode=default
  [ok] postgres healthy
  [ok] uvicorn already up
  > POST /chat (ticker=TUPRS, mode=default)
    thesis_id = 78b2...
  > WS event stream (max 320s)...
    [  0.4s] stage = parallel_3_bacak
    [  4.2s] stage = parallel_workers
    [ 22.1s] stage = devils_advocate
    [ 31.8s] critique  strength=50  risks=4  base_rate=1
    [ 33.0s] stage = synthesizer
    [ 58.3s] stage = validator
    [ 71.4s] DONE confidence=70.8 kaynaksız=False
  > GET /api/thesis/78b2.../citations
  [ok] Çıktı yazıldı: .../thesis_output_TUPRS_default.md
       thesis_md=5024 char  |  bull=6  |  bear=6  |  catalyst=3
       confidence=70.8/100  |  kaynaksız_flag=False  |  squad=Energy
```

### 6.5. Sorun giderme

| Belirti | Sebep | Çözüm |
|---|---|---|
| `uvicorn 30s içinde ayağa kalkmadı` | port 8000 dolu / venv eksik / import hatası | `tail -50 /tmp/thesisforge_uvicorn.log` |
| `429 ResourceExhausted` log'da çok | Gemini free tier RPM=5 sınırı | Tier 1 billing aç ya da peş peşe değil aralıklı koş |
| `WS timeout 240s` | bir ajan takıldı (genelde LLM) | Pipeline 120s watchdog ile zaten kesilir; yeniden dene |
| `kaynaksız_flag=True` | bir/birden fazla sayılı bullet UUID'siz | `thesis_output_*.md` §7 Citation Audit tablosuna bak, `is_kaynaksiz=True` satırları gör |
| postgres `unhealthy` | docker daemon kapalı / port 5433 dolu | `docker ps`, `docker compose logs postgres` |

---

## 7. Çıktı dosyasını okumak

`thesis_output_<TICKER>_<MODE>.md` 7 bölümlüdür:

1. **Header** — thesis_id, squad, mode, final confidence, kaynaksız flag
2. **Markdown Tez** — synthesizer'ın ürettiği 8-bölümlü Türkçe rapor (TL;DR,
   Bull Case, Bear Case, Anahtar Katalizörler, Tarihsel Bağlam, Risk Uyarıları,
   Güven Skoru, Disclaimer)
3. **Confidence Breakdown** — 6 bileşen + computed_raw + applied_cap + final
4. **Bull Points** — yapılandırılmış JSON çıkarımı: her bullet için
   `score (0-10)` + `call_id`
5. **Bear Points** — aynı format
6. **Catalysts** — `date` + `impact (high/medium/low)` + `call_id`
7. **Devil's Advocate** — ham counter-argümanlar (technical/fundamental
   pushback, cross-cutting risks, base rate warnings, overall_critique_strength)
8. **Citation Audit** — her claim için `is_kaynaksiz`, `call_id`, ilk
   140 karakterlik claim metni — kaynaksız satırları ayıklamak için en
   pratik bölüm

---

## 8. Bilinen sorunlar ve iyileştirme alanları

Pipeline çalışıyor ama üretilen tezlerde elden geçirilmesi gereken
gerçek vakalar var. Aşağıdaki tespitler TUPRS / BIMAS / GARAN
çıktılarından gözlemlendi.

### 8.1. **Halüsinasyon: TL;DR'da uydurulmuş sayı** (kritik)

`thesis_output_TUPRS_default.md` §1 — TL;DR'ın son cümlesi:

> "Kısa vadede **269.5 TL** direnci kritik."

Ancak **269.5 sayısı tezde başka hiçbir yerde geçmiyor**:
- Body'de support 246.69 TL, kapanış 258.5 TL, 20g SMA 262.96 TL var.
- Worker observation havuzunda 269.5 yok.

**Neden validator yakalamadı:** Sayı TL;DR'da, **`[kaynak: ...]` etiketi
takılmadan** geçti. 3 katmanlı validator yalnızca etiketli claim'ler için
çalışır:
- Katman 1-2 (regex parse + PK lookup) → etiket yoksa tarayacak şey yok.
- Katman 3 (numeric sanity) → "etiketten önceki cümledeki sayılar tool
  sonucunda var mı?" — etiket olmadığı için bu kontrol tetiklenmedi.

`had_kaynaksiz_flag` ise TL;DR'ı paragraf cümlesi olduğu için zaten
saymaz (bullet değil).

**Önerilen çözüm:** `synthesizer.md`'ye sert kural ekle:

> *"TL;DR'da geçen her sayısal değerin Bull veya Bear bölümlerinde
> aynı sayıyla **kaynaklı atıfı bulunmak zorunda**. Observation
> havuzunda olmayan seviye/değer TL;DR'a yazılamaz."*

Daha güçlü ek savunma: validator'a "**numbers-without-citation in
paragraph mode**" katmanı (`_FACTUAL_NUMBER_RE` paragraf cümlelerinde
de tarar, eşleşen bir UUID yoksa warn log) — şu an sadece bullet'ları
tarıyor.

### 8.2. **"Veri yok" cümlesi Bear Case bullet'ına dönüyor**

Worker prompt'ları "metrik tool çıktısında yoksa AYRI bir observation
olarak 'bu veri dönmedi' uyarısı yaz" diyor. Synthesizer bu uyarıyı
**olduğu gibi Bear Case bullet'ına** çeviriyor:

- TUPRS Bear #5: *"Şirketin EBITDA marjı hakkında doğrudan bilgi
  verilmemesi…"*
- GARAN Bear #3: *"Bankacılık-spesifik temel oranlar (NIM, CAR, NPL,
  CASA, ROE, cost-to-income) eksikliği…"*

Yatırım tezinde Bear bölümü "**veri var, kötü**" demeli; "veri yok"
sinyali Güven Skoru bölümünde `data_quality` düşüklüğü olarak
özetlenmeli.

**Önerilen çözüm:** `synthesizer.md`'ye yasak — *"Worker observation'ı
'bu metrik mevcut değil/dönmedi' türü uyarıysa Bear Case bullet'ına
KOYMA; Güven Skoru bölümünde data_quality nedeni olarak tek cümle
özetle."*

### 8.3. **Technical score floor'u yok — anormal düşük momentum**

GARAN tezinde `confidence_breakdown.technical = 7.0`. RSI 42 nötr
bölge, hisse SMA'nın %4.6 altında — kötü ama 7 değil. Sonuç:
final confidence 51.9'a çakıldı (ağırlık 0.20).

**Önerilen çözüm:** `technical_worker.py`'da `momentum_score`
hesabında floor ekle (örn. `max(score, 20)`); ya da scoring
bantlarını yeniden kalibre et — tek-yön negatif yığını skoru
0'a yaklaştırmamalı.

### 8.4. **Risk Uyarıları kronik kaynaksız**

`synthesizer.md`'de **Bear Case** için "%70 kaynak" kuralı var, ama
**Risk Uyarıları** için yok. Sonuç: üç tezde de Risk maddeleri
sayı içerse bile UUID koyulmuyor — BIMAS Risk #3 "Cari oran
düşüklüğü" diyor ama Bear Case'te aynı veriye (1.07) atıf yapan
UUID'yi tekrar kullanmıyor.

**Önerilen çözüm:** Synthesizer prompt'una eşdeğer kural — *"Risk
maddesi sayı içeriyorsa Bear/Fundamental observation'ından **UUID
tekrar kullan**; sadece soyut makro/regülasyon/jeopolitik riski
kaynaksız bırakılabilir."*

### 8.5. **Extractor score'ları çok uniform**

`extract_structured` (Flash) BIMAS tezinde 6 bear'in 4'üne `score 8`
verdi; TUPRS bull'larında 5'inin 9 puan aldı. Skorlama
discriminative değil — UI'de "en güçlü 3 bullet" sıralaması yapmak
için yararsız.

**Önerilen çözüm:** Extractor prompt'undaki skor rubric'ini
sertleştir — "sayı + mekanizma + zaman ufku + UUID **dördü birden**
olan 9-10; üçü olan 7-8; ikisi olan 5-6" gibi sıkı bantlar koy.

### 8.6. **Catalyst'ler hep `call_id=None`**

Üç tezde de tüm Catalysts `call_id: None`. Bu **kısmen beklenen**:
catalyst'ler gelecek tarih + olay birleşimi (örn. "2026-Q2 OPEC+
toplantısı"), worker observation havuzunda direkt eşleşmez. Ama
şu anki worker prompt'ları KAP filings'i taradığı için **somut
duyurular** (sermaye artırımı tarihi, temettü ödeme tarihi, finansal
takvim) eşleşebilir — fırsat kullanılmıyor.

**Önerilen çözüm:** `fundamental_*.md`'ye "KAP'tan tarihli
duyuruları catalyst observation olarak ayrıca çıkar" maddesi ekle;
synthesizer bunları kaynaklı catalyst yapar.

### 8.7. **`run.sh` sıfırdan setup yapmıyor**

§6.1'de detaylı listelendi. Özet: venv, `pip install`, `.env`,
`alembic upgrade head` ve Docker daemon kontrolü manuel. Tek-komut
iddiası için `run.sh`'a bootstrap modu (idempotent setup) eklenebilir.

### 8.8. **Memory havuzu pratik olarak boş** (operasyonel)

Üç tezde de "Tarihsel Bağlam: Bu hisse için memory havuzunda
eşleşen önceki tez bulunmadı." satırı var. Sistem yeni olduğu için
embedding aramaları boş dönüyor. Çözüm değil, **gözlem**: pipeline
birkaç ay çalıştıkça `memory_agent.search_memory` faydalı sonuç
vermeye başlayacak. `memory_base` skoru şimdilik hep nötr (50).

### 8.9. **Validator katman 3 sessizce log'a yazıyor**

Numeric sanity başarısızlıkları (`final_numeric_issues`) sadece
`log.warning("citation_retry", numeric_issues=N)` olarak görülür;
DB'ye yazılmıyor, UI'de görünmüyor. "Sayı tool sonucuyla eşleşmedi"
sinyali türetilmiş metrikler için yanlış-pozitif olduğu için flag
karartmıyor — ama bilinçli olarak görünür kılmak isteyen biri
`tool_call_logs`'a `numeric_issue` kolonu ekleyip rapor edebilir.

---

## 9. İlgili dosyalar (hızlı referans)

| Konu | Dosya |
|---|---|
| Pipeline akışı | `backend/app/agents/orchestrator.py` |
| Citation validator + flag mantığı | `backend/app/citations/validator.py` |
| Confidence formülü | `backend/app/agents/confidence.py` |
| Synthesizer (markdown yazıcı) | `backend/app/agents/synthesizer.py` |
| Synthesizer prompt | `backend/app/agents/prompts/synthesizer.md` |
| Squad fundamental prompt'ları | `backend/app/agents/prompts/fundamental_*.md` |
| Devil's advocate prompt | `backend/app/agents/prompts/devils_advocate.md` |
| Squad eşlemesi | `backend/sector_map.yaml` |
| REST endpoint'leri | `backend/app/api/thesis_rest.py`, `backend/app/api/chat.py` |
| WebSocket hub | `backend/app/api/ws_hub.py`, `backend/app/api/thesis_ws.py` |
| Tek-komut runner | `run.sh` (repo kökünde) |
| WS dinleyici / md yazıcı | `backend/scripts/run_thesis.py` |
| Ortam kurulumu rehberi | `backend/TESTING.md` |