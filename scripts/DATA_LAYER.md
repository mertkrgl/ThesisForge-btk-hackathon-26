# ThesisForge — Veri Katmanı Dokümantasyonu

> **Branch:** `spike/data-probe` · **Amaç:** Veri katmanını test etmek ve production'a hazır veri çekme modüllerini doğrulamak. Bu branch'te **agent kodu yok** — sadece API'ler ve veri çekme.
>
> İlgili truth file'lar: [`../BLUEPRINT.md`](../BLUEPRINT.md), [`../docs/data.md`](../docs/data.md), [`../docs/agents.md`](../docs/agents.md), [`../docs/flows.md`](../docs/flows.md)

---

## 1. Genel Bakış

`scripts/` altında 2 klasör var:

| Klasör | Amaç | Üretim ortamında kullanılır mı? |
|---|---|---|
| `test/` | API'lerin çalışıp çalışmadığını doğrulayan probe scriptleri | Hayır, sadece sağlık kontrolü |
| `product/` | Projede agent'ların kullanacağı veri çekme modülleri | Evet, agent branch'inde import edilecek |

**Hızlı durum:** 7 kaynaktan 5'i tam çalışıyor, 1'i kısmi (isyatirim UFRS), 1'i yok-sayılı (KAP RSS — pykap yedek). Detaylı kapsam tablosu §4'te.

---

## 2. Klasör Yapısı ve Çalıştırma

```
scripts/
├── test/                       — API probe'lar (sağlık kontrolü)
│   ├── config.py               # .env.probe yükler
│   ├── run_all.py              # ⭐ Tüm probe'ları çalıştır, tablo bas
│   ├── probe_tcmb.py           # TCMB EVDS
│   ├── probe_mkk.py            # MKK API
│   ├── probe_yfinance.py       # yfinance
│   ├── probe_isyatirim.py      # isyatirimhisse
│   ├── probe_borsapy.py        # borsapy
│   ├── probe_kap_pykap.py      # pykap
│   ├── probe_kap_rss.py        # KAP RSS (kırık, kept for reference)
│   ├── list_companies.py       # MKK/pykap/borsapy şirket listesi → CSV
│   └── examples.py             # Hızlı kullanım örnekleri
│
└── product/                    — Production veri çekme modülleri
    ├── __init__.py             # Public API export
    ├── config.py               # Env değişkenleri + base URL'ler
    ├── macro.py                # TCMB makro (USD/TRY, EUR/TRY, TÜFE, faiz)
    ├── companies.py            # MKK şirket listesi (BIST 704 + 333 üye)
    ├── prices.py               # yfinance OHLCV + endeks + Brent + temettü
    ├── financials.py           # isyatirim IFRS çeyreklik bilanço
    ├── disclosures.py          # MKK + pykap KAP bildirimleri
    ├── analyst.py              # borsapy tavsiye + sektör + FX
    ├── technicals.py           # pandas-ta indikatör + sinyal
    ├── news.py                 # Google News + decoder + meta description
    └── thesis_bundle.py        # ⭐ Tek çağrıda bir ticker için TÜM veri
```

### 2.1 Kurulum

```bash
cd /home/mert/Masaüstü/btk-hackathon'26
pip install -r requirements-probe.txt --break-system-packages
# .env.probe dosyası key'leri içerir (gitignore'da, repoda yok)
```

`.env.probe` zorunlu alanlar:
```
TCMB_EVDS_KEY=...
MKK_API_KEY=...
MKK_API_SECRET=...
```

### 2.2 Çalıştırma Komutları

```bash
# Test (API sağlık kontrolü) — tek seferlik
cd scripts/test
python3 run_all.py                  # tüm kaynakları test et, tablo bas
python3 probe_mkk.py                # tek kaynak test
python3 list_companies.py mkk       # 1037 üye → mkk_companies.csv

# Product (gerçek veri çekme)
cd scripts/product
python3 thesis_bundle.py THYAO      # ⭐ Tek hisse için tüm veri (~35s)
python3 thesis_bundle.py GARAN      # başka bir hisse
python3 macro.py                    # sadece TCMB makro
python3 news.py THYAO               # sadece haberler (detaylı)
python3 financials.py               # finansal tablo örneği
```

---

## 3. API Kaynakları ve Auth Yöntemleri

| Kaynak | Auth | Base URL | Çektiği Veri | Notlar |
|---|---|---|---|---|
| **TCMB EVDS** | Header `key: <KEY>` | `evds3.tcmb.gov.tr/igmevdsms-dis` | Makro (TÜFE, USD/TRY, faiz) | 5 Nis 2024'te API değişti; eski `evds2 + ?key=` artık çalışmıyor |
| **MKK API** | `Authorization: Basic <base64(key:secret)>` | `apigwdev.mkk.com.tr/api/vyk` | 11 KAP servisi (üye, fon, bildirim, detay) | Token-based değil — statik Basic Auth |
| **yfinance** | Yok | (Yahoo) | OHLCV, endeks (XU100.IS), temettü, Brent (BZ=F) | `.IS` suffix BIST için zorunlu |
| **isyatirimhisse** | Yok | (İş Yatırım public JSON) | Fiyat + IFRS çeyreklik (XI_29/UFRS) | `start_year`+`end_year` parametre vermek zorunlu |
| **borsapy** | Yok | Çoklu kaynak (TradingView, Mynet) | Analist tavsiyesi, FX, screener, sektör arama | `recommendations` property kritik |
| **pykap** | Yok | `kap.org.tr/tr/api/*` | KAP bildirimleri (alternatif/yedek) | MKK API ile aynı veriye public erişim |
| **Google News + decoder** | Yok | `news.google.com/rss/search` | Şirket-spesifik + makro haber | `googlenewsdecoder` Google'ın obfuscated URL'lerini gerçek kaynağa çevirir |

### 3.1 Önemli Auth Detayları

**MKK için:** Resmi MKK dokümantasyonu `generateToken` endpoint'i üzerinden token-bazlı bir akış tarif ediyordu — ancak bu endpoint sürekli **401 Unauthorized** dönüyordu ve hiçbir resmi kaynakta gerçek auth yönteminin ne olduğu yazmıyordu. **Kullanıcı (Mert)** MKK portalın **"Dökümantasyon & Test → API Trafik"** sekmesindeki istek log'larını inceleyerek `Authorization: Basic <base64>` header'ını fark etti ve bu base64'ün aslında `apiKey:apiSecret` formatının encode edilmiş hali olduğunu keşfetti. Yani gerçek auth yöntemi **token değil, statik Basic Auth**. Resmi dokümantasyon bu noktada yanıltıcıdır.

**TCMB için:** `?key=...` URL parametresi **artık çalışmaz** (5 Nisan 2024 değişikliği). HTTP header `key: <KEY>` zorunlu.

---

## 4. BLUEPRINT.md Veri Gereksinimleri vs Mevcut Kapsam

[`docs/data.md §3`](../docs/data.md) Modül-Kaynak Eşleştirme Matrisi'nin tamamı:

| # | İstenen Veri | Hangi Agent? | Primary API | Product Fonksiyonu | Durum |
|---|---|---|---|---|---|
| 1 | Makro context (TÜFE, USD/TRY, EUR/TRY, politika faizi) | Macro Context | TCMB EVDS | `macro.get_macro_context()` | ✅ |
| 2 | Sector mapping (ticker → squad) | Sector Router | `sector_map.yaml` (lokal) | — | ❌ |
| 3 | OHLCV 90 gün | Technical Worker | yfinance | `prices.get_ohlcv()` | ✅ |
| 4 | Teknik indikatör (RSI/MACD/Bollinger/ATR) | Technical Worker | pandas-ta (lokal) | `technicals.compute_indicators()` | ✅ |
| 5 | BIST endeks (XU100, XBANK, vb.) | Technical Worker | yfinance | `prices.get_index()` | ✅ |
| 6 | KAP filings (şirket bildirimleri) | Fundamental Worker | MKK API | `disclosures.get_company_disclosures()` | ✅ |
| 7 | IFRS çeyreklik finansal tablo | Fundamental Worker | isyatirim | `financials.get_financials()` | ✅ |
| 8 | Analist tavsiyesi (AL/SAT/TUT + hedef) | Fundamental Worker | borsapy | `analyst.get_recommendation()` | ✅ |
| 9 | Peer compare (sektör hisseleri yan yana) | Fundamental Worker | borsapy scanner | `analyst.search_sector()` | ⚠️ Arama var, side-by-side compare yok |
| 10 | Temettü geçmişi | Fundamental Worker | yfinance | `prices.get_dividends()` | ✅ |
| 11 | Şirket-spesifik haber | Fundamental + Synthesizer | Google News RSS | `news.get_company_news()` | ✅ Detay özet dahil |
| 12 | Makro/piyasa haberi | Macro Context + Synthesizer | Google News + Mynet | `news.get_market_news()` | ✅ |
| 13 | Brent petrol (Energy squad) | Fundamental Worker | yfinance BZ=F | `prices.get_brent_oil()` | ✅ |
| 14 | Şirket genel bilgi (denetçi, KAP ID) | Tüm worker'lar | MKK API | `companies.get_company_by_ticker()` | ✅ |
| 15 | Memory embedding | Memory Agent | OpenAI text-embedding-3-large | — | ❌ Key bekleniyor |
| 16 | Memory similarity search | Memory Agent | pgvector cosine | — | ❌ DB kurulumu yok |

### 4.1 Squad-Spesifik Veri Notları

`agents.md §3` 5+1 squad sistemini tanımlıyor. Ham veri elimizde ama **squad-spesifik türev hesaplar agent tarafında yapılacak:**

| Squad | Anahtar Metrik | Ham Veri Kaynağımız | Hesap Eksik? |
|---|---|---|---|
| Banking | NIM, NPL, CAR, CASA | `financials.get_financials("GARAN")` | ✅ Evet |
| Energy | Refining margin, Brent kor. | `financials` + `prices.get_brent_oil()` | ✅ Evet |
| Defense | Backlog, R&D, USD revenue | `disclosures` (sözleşme bildirimi) + `financials` | ✅ Evet |
| Retail | LFL büyüme, mağaza sayısı | `financials` + `disclosures` (faaliyet raporu) | ✅ Evet |
| RealEstate | NAV iskonto, doluluk | `financials` + `disclosures` | ✅ Evet |
| Generic | P/E, P/B, ROE, EBITDA | `financials` | ✅ Evet (temel oranlar var) |

---

## 5. Agent-Aşama-Veri Akışı

[`docs/flows.md §1`](../docs/flows.md) uçtan uca sequence diagram'ına göre 8 ajan ve 52 saniyelik pipeline:

```
┌────────────────────────────────────────────────────────────────────┐
│ AŞAMA 1 (0-2s) — Paralel 3-bacak                                  │
├────────────────────────────────────────────────────────────────────┤
│  Sector Router    → lookup_sector(ticker)               [EKSİK]   │
│  Macro Context    → get_macro_context()                 ✅        │
│                   + get_market_news()                   ✅        │
│  Memory Agent     → similarity search (top_k=3)         [EKSİK]   │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ AŞAMA 2 (2-20s) — Paralel 2-Worker (max 5 tool call her biri)     │
├────────────────────────────────────────────────────────────────────┤
│  Technical Worker:                                                 │
│    → get_ohlcv(ticker, days=90)                         ✅        │
│    → compute_indicators(df) + technical_signal()        ✅        │
│    → get_index("XU100")                                 ✅        │
│    → [detect_patterns] [find_support_resistance]        ❌        │
│                                                                    │
│  Fundamental Worker:                                               │
│    → get_company_disclosures(ticker, days=30)           ✅        │
│    → get_financials(ticker, years=2)                    ✅        │
│    → get_recommendation(ticker)                         ✅        │
│    → get_company_news(ticker, with_summary=True)        ✅        │
│    → get_dividends(ticker)                              ✅        │
│    → search_sector(squad)                               ⚠️        │
│    → get_brent_oil() (Energy ise)                       ✅        │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ AŞAMA 3 (20-28s)                                                  │
├────────────────────────────────────────────────────────────────────┤
│  Devil's Advocate (Pro):                                           │
│    • Veri çekmez — sadece Worker output'unu sorgular              │
│    • base_rate_check için Memory'ye sorar              [EKSİK]   │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ AŞAMA 4 (28-48s)                                                  │
├────────────────────────────────────────────────────────────────────┤
│  Synthesizer (Pro, streaming):                                     │
│    • Tüm bundle + Worker raporu + Devil critique alır             │
│    • Markdown tez üretir, her claim [kaynak: <call_id>]           │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ AŞAMA 5 (48-52s)                                                  │
├────────────────────────────────────────────────────────────────────┤
│  Citation Validator → tool_call_logs'a karşı doğrula    [EKSİK]   │
│  DB persist (theses + citations)                        [EKSİK]   │
│  Memory Agent async write (embed + pgvector)            [EKSİK]   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Veriler Agent'a Nasıl Verilmeli?

### 6.1 Tek Kapı: `thesis_bundle.build_thesis_bundle(ticker)`

Bu fonksiyon bir ticker için **tüm kaynaklardan veri toplayıp tek dict döndürür**. Agent'ların pipeline başlangıcında çağıracağı tek nokta.

```python
from product.thesis_bundle import build_thesis_bundle
bundle = build_thesis_bundle("THYAO")
```

### 6.2 Bundle Yapısı

```python
{
  "ticker": "THYAO",
  "fetched_at": "2026-05-12T20:45:00",
  "macro": {                       # → Macro Context Agent
    "usd_try": 45.29,
    "eur_try": 53.30,
    "tufe_last": ...,
    "policy_rate": 40.0,
  },
  "company": {                     # → Tüm agent'lar (referans)
    "id": "1107",
    "title": "TÜRK HAVA YOLLARI A.O.",
    "stockCode": "THYAO",
    "memberType": "IGS",
  },
  "price": {                       # → Technical Worker
    "source": "yfinance",
    "last_close": 305.75,
    "change_pct": -9.27,
    "last_date": "2026-05-12",
  },
  "technical": {                   # → Technical Worker
    "rsi_14": 46.8, "macd": -0.56,
    "bb_upper": 333.2, "atr_14": 8.3,
    "signal": {"trend": "bullish", "momentum": "neutral", ...}
  },
  "financials": {                  # → Fundamental Worker
    "period": "2026/3",
    "Dönen Varlıklar": "485646000000", ...
  },
  "ratios": {                      # → Fundamental Worker
    "cari_oran": 0.97,
    "borc_ozkaynak": 1.23, ...
  },
  "disclosures": [                 # → Fundamental Worker
    {"date": "2026-04-29", "title": "..."},
  ],
  "analyst": {                     # → Fundamental Worker
    "recommendation": "AL",
    "target_price": 455.0,
    "upside_potential": 48.81,
  },
  "company_news": [                # → Fundamental + Synthesizer
    {"title": "...", "source": "Paratic", "summary": "..."},
  ],
  "market_news": [                 # → Macro Context + Synthesizer
    {"title": "...", "source": "Bigpara"},
  ],
  "brent_oil_usd": 107.36,         # → Fundamental Worker (Energy)
  "errors": {},                    # → Confidence score için
}
```

### 6.3 Agent → Bundle Field Eşleşmesi

| Agent | Alması Gereken Field'lar | Nasıl Kullanır |
|---|---|---|
| **Macro Context** | `macro`, `market_news` | Cümle bazlı paragraf üretir, her cümleye `[kaynak: tcmb_evds]` etiketi |
| **Sector Router** | `company.title`, `company.stockCode` | `sector_map.yaml` lookup → squad döner |
| **Technical Worker** | `price`, `technical`, `company` | `TechnicalAnalysis` Pydantic şemasına serialize eder |
| **Fundamental Worker** | `financials`, `ratios`, `disclosures`, `analyst`, `company_news`, `company`, (Energy ise `brent_oil_usd`) | Squad'a göre filtreleme yapar; örn. Banking ise `compute_ratios`'ta NIM/NPL hesaplar |
| **Devil's Advocate** | Worker çıktıları (bundle değil) + Memory `base_rate` | Bull/bear sorgulamaları üretir |
| **Synthesizer** | Bundle'ın tamamı + Worker raporları + Devil critique + Memory similarity hits | Streaming Markdown tez |
| **Memory Agent** | Tezin kendisi (yazma) + yeni sorgu embedding'i (okuma) | pgvector cosine top_k=3 |

### 6.4 Citation Provenance (BLUEPRINT'in Kritik Şartı)

`agents.md §4` der ki: *"Her tool call `tool_call_logs` tablosuna UUID call_id ile yazılır. Synthesizer her `[kaynak: <call_id>]` etiketini ID-bazlı doğrular."*

**Şu an yapılmıyor.** Product fonksiyonları sadece ham veri döner. Agent branch'inde her çağrı şu wrapper'a girmeli:

```python
@logged_tool(name="get_macro_context")
async def get_macro_context_tool() -> dict:
    call_id = uuid4()
    result = product.macro.get_macro_context()
    db.tool_call_logs.insert({
        "call_id": call_id,
        "agent_id": current_agent,
        "tool_name": "get_macro_context",
        "args": {},
        "result": result,
        "ts": now(),
    })
    return {"call_id": call_id, "data": result}
```

---

## 7. Eksikler — 3 Kategori

### Kategori A: Veri kaynağı eksik (kurulum gerekli)

| Eksik | Çözüm |
|---|---|
| Sector Router | `sector_map.yaml` lokal dosya (BIST 50 statik mapping) |
| Memory embedding | OpenAI API key + `openai` SDK |
| Memory similarity | PostgreSQL + pgvector extension + Alembic migration |

### Kategori B: Türev hesap eksikleri (agent tarafında çözülebilir)

| Eksik | Notu |
|---|---|
| Squad-spesifik metrikler (Banking NIM/NPL, Energy refining margin, Retail LFL, RealEstate NAV) | Ham veri elimizde, `compute_ratios`'ı squad-aware yap |
| Pattern detection (head-shoulders, double-top) | TA-Lib veya pandas-ta candlestick patterns |
| Support/resistance pivot points | Lokal hesap |
| Relative strength (hisse vs endeks) | Lokal hesap (mevcut OHLCV + index ile) |
| Peer compare side-by-side tablo | `search_sector` + her ticker için ratios birleştir |

### Kategori C: Format ve veri kalitesi

| Sorun | Örnek | Çözüm |
|---|---|---|
| Sayılar string olarak geliyor | `"485646000000"` | `"485.6 milyar ₺"` formatter |
| Tarih formatları tutarsız | `12-05-2026` vs `Tue, 12 May` vs `2026-05-12` | ISO 8601 normalize |
| TÜFE ham endeks değeri | `10882474015.0` (anlamsız) | YoY % değişim hesabı (önceki yıl bu ay / şimdi) |
| Citation provenance | Her veri kalemi için `call_id` yok | Tool wrapper (§6.4) |
| Pydantic schemas | Çıktılar dict | `TechnicalAnalysis`, `Critique` schema'ları (`agents.md §2`) |

---

## 8. Tamamlanma Yüzdesi

| Katman | Tamamlanma | Not |
|---|---|---|
| **Veri API erişimi** | **%92** | 16 modülden 14 çalışıyor veya alternatifli |
| **Veri formatlama** | **%40** | Raw veri OK, LLM-friendly format yarım |
| **Citation provenance** | **%0** | `tool_call_logs` agent branch'inde |
| **Agent framework (Strands)** | **%0** | Bu branch'in scope'unda değil |
| **Cache (Redis) + Fixture** | **%0** | Agent branch'inde |
| **Memory + DB** | **%0** | OpenAI key + pgvector kurulumu agent branch'inde |

---

## 9. Agent Branch'inde Yapılması Gerekenler (Sırayla)

1. **Strands kurulumu** + tek agent örneği (Macro Context) → "hello world" tez
2. **Tool wrapper'lar** — `product/` fonksiyonlarını `@tool` decorator ile Strands'a bağla
3. **Pydantic output schemas** — `TechnicalAnalysis`, `Critique`, `MacroContext` (`agents.md §2`)
4. **Citation framework**
   - SQLAlchemy `tool_call_logs` modeli
   - Her tool call'a UUID `call_id` atayan wrapper
   - Synthesizer'da `[kaynak: <call_id>]` ID-bazlı validate
5. **DataProvider chain** — şu an product'ta sadece primary çağrılıyor; chained fallback (primary→secondary→fixture) sarmalayıcı yaz
6. **Cache katmanı (Redis)** — [`data.md §8`](../docs/data.md) TTL tablosuna göre 15 key pattern
7. **Fixture sistemi** — `fixtures/<domain>/<key>.json` 48 saat snapshot writer
8. **Sector Router** — `backend/config/sector_map.yaml` + `lookup_sector()` fonksiyonu
9. **Memory Agent** — OpenAI text-embedding-3-large + pgvector cosine similarity + gece cron (02:00 UTC outcome update)
10. **Format katmanı** — sayı (₺/milyar), tarih (ISO), birim normalizer (LLM-friendly)
11. **Conservative Mode** — Synthesizer prompt flag (`bear_first`, `confidence_cap=70`, `dividend_emphasis`)
12. **Confidence score** — [`agents.md §6`](../docs/agents.md) 6-bileşenli formül

---

## 10. Hızlı Referans

| Konu | Dosya |
|---|---|
| Proje portalı | [`../BLUEPRINT.md`](../BLUEPRINT.md) |
| Veri katmanı truth | [`../docs/data.md`](../docs/data.md) |
| Agent kataloğu | [`../docs/agents.md`](../docs/agents.md) |
| Sequence + flows | [`../docs/flows.md`](../docs/flows.md) |
| Database şeması | [`../docs/database.md`](../docs/database.md) |
| Production veri çekme entry point | [`product/thesis_bundle.py`](product/thesis_bundle.py) |
| API sağlık kontrolü | [`test/run_all.py`](test/run_all.py) |
| .env şablonu | `../.env.probe` (gitignore'da) |
