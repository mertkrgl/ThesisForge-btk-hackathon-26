# VERI.md — ThesisForge Veri Katmanı

> **Truth file (veri katmanı).** Tüm veri kaynakları, fallback zincirleri, modül-kaynak eşleştirmeleri ve onboarding prosedürleri bu dosyada toplanmıştır. `BLUEPRINT.md` D bölümü bu dosyaya referans verir; çelişki halinde **VERI.md** geçerlidir.
>
> Son güncelleme: 2026-05-12 · Sürüm: 1.0

## İçindekiler

1. [Veri Katmanı Felsefesi](#1-veri-katmanı-felsefesi)
2. [Kaynak Kataloğu](#2-kaynak-kataloğu)
3. [Modül-Kaynak Eşleştirme Matrisi](#3-modül-kaynak-eşleştirme-matrisi)
4. [Karar Gerekçeleri (Niye Hangi Kaynak)](#4-karar-gerekçeleri)
5. [DataProvider Interface ve Registry](#5-dataprovider-interface-ve-registry)
6. [Onboarding / Kayıt Prosedürleri](#6-onboarding--kayıt-prosedürleri)
7. [Fallback Senaryoları](#7-fallback-senaryoları)
8. [Cache & TTL Tablosu](#8-cache--ttl-tablosu)
9. [Rate Limit & Politeness Politikası](#9-rate-limit--politeness-politikası)
10. [Lisans ve Atıf](#10-lisans-ve-atıf)
11. [Bilinen Riskler ve Açık Sorular](#11-bilinen-riskler-ve-açık-sorular)
12. [v2 Roadmap (Veri Katmanı)](#12-v2-roadmap-veri-katmanı)

---

## 1. Veri Katmanı Felsefesi

> Her veri kaynağı `DataProvider` interface'i arkasındadır. Her sorgu **üç seviyeli fallback** zincirinden geçer: **primary → secondary → fixture**. Her başarılı çağrı `tool_call_logs` tablosuna UUID `call_id` ile yazılır; bu ID Synthesizer'ın `[kaynak: <call_id>]` etiketleri için **provenance**'ın temelidir. Hiçbir agent doğrudan HTTP çağrısı yapmaz — sadece registry üzerinden provider çağrısı yapar. Bu sayede:

- Yeni kaynak eklemek → registry'ye 1 satır.
- Test mode → registry'yi fixture-only provider'a çevirerek tüm pipeline LLM olmadan koşar.
- Demo mode (kill-switch) → registry fixture priority'ye flip eder.
- Her sayı / iddia tool_call_logs'ta canlı kanıta bağlıdır (citation-grounded).

---

## 2. Kaynak Kataloğu

| Kaynak | Tür | Auth | Ücret | Rate Limit | Stabilite | Erişim Şekli |
|---|---|---|---|---|---|---|
| **TCMB EVDS** | Makro (TÜFE, faiz, USD/TRY, CDS, BIST 100) | API key (email kaydı) | Ücretsiz | 300 req/dk (resmi) | ✅ Yüksek (resmi devlet kurumu) | Direct HTTPS REST |
| **TCMB EVDS enflasyon endpoint** | TÜFE/ÜFE hızlı erişim | Yok | Ücretsiz | İmplisit | ✅ Yüksek | Direct HTTPS |
| **MKK API Portal** (`apiportal.mkk.com.tr`) | KAP bildirimleri + 12 KAP veri yayın servisi | API key (hesap onay süreci) | **Ücretsiz** | Doc'tan teyit (başvuru sonrası) | ✅ Yüksek (resmi MKK) | Direct REST |
| **KAP RSS** (`kap.org.tr/tr/RssAjax`) | Son N bildirim (fallback) | Yok | Ücretsiz | İmplisit | ⚠️ Orta (resmi public ama API garantisi yok) | RSS parser |
| **isyatirimhisse** (PyPI) | BIST hisse fiyatı + endeks + IFRS finansal tabloları (XI_29 / IFRS / IFRS_K) | Yok | Ücretsiz | IP-ban riski; ≤1 req/sn önerilir | ⚠️ Orta (yarı-resmi: İş Yatırım'ın public JSON endpoint'i, kütüphane unofficial) | PyPI: `isyatirimhisse` |
| **borsapy** (PyPI) | BIST gelişmiş hisse arama, analist tavsiyesi, scanner | Yok | Ücretsiz | IP-ban riski | ⚠️ Orta (yarı-resmi) | PyPI: `borsapy` |
| **yfinance** (PyPI) | BIST fiyat (`.IS` suffix), basic financials | Yok | Ücretsiz | Yahoo politika değişikliği riski | ⚠️ Orta | PyPI: `yfinance` |
| **pandas-ta** (PyPI) | 130+ teknik indikatör (RSI, MACD, Bollinger, ATR) | — | Ücretsiz | — (lokal hesap) | ✅ Yüksek | PyPI: `pandas-ta` |
| **Mynet Finans** (scrape) | Türkçe hisse haberi | Yok | Ücretsiz | Anti-bot riski | ❌ Düşük | Playwright + BeautifulSoup |
| **Bigpara** (scrape) | Türkçe hisse haberi (secondary) | Yok | Ücretsiz | Anti-bot riski | ❌ Düşük | Playwright + BeautifulSoup |
| **TwelveData free tier** (opsiyonel) | Secondary BIST fiyat | API key | Ücretsiz tier | 8 req/dk | ⚠️ Orta | Direct REST |
| **text-embedding-3-large** (OpenAI) | Memory Agent embedding | API key | Ücretli ama düşük | 3000 RPM Tier 1 | ✅ Yüksek | OpenAI SDK |

### 2.1 Önemli notlar

- **MKK API Portal ile İş Bankası API Portal (`apiportal.isbank.com.tr`) farklı kurumlardır.** Karıştırılmamalı.
- **isyatirim ≠ İş Bankası API Portal.** `isyatirimhisse` kütüphanesi `https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?...` formundaki **auth'suz public JSON endpoint'lerini** wrap'liyor. OAuth, hesap, müşteri bağı yok. Banka API'si değil, aracı kurumun public web verisi.
- **borsa-mcp** (`github.com/saidsurucu/borsa-mcp`) bu projeye **kod olarak dahil edilmedi** — yalnızca referans olarak okundu. MIT lisansı izin verdiği halde sıfırdan yazmayı tercih ediyoruz (BTK 26 jüri psikolojisi + bağımsız implementasyon).

---

## 3. Modül-Kaynak Eşleştirme Matrisi

Her agent / worker hangi kaynağı hangi sırayla çağırır:

| Modül / Agent | Primary | Secondary | Fixture | Cache TTL |
|---|---|---|---|---|
| **Macro Context Agent** | TCMB EVDS (key'li) | TCMB enflasyon endpoint (key'siz) | `fixtures/macro/latest.json` | 15 dk |
| **Sector Router** | `sector_map.yaml` (lokal) | LLM fallback (Gemini Flash) | — | — |
| **Technical Worker — OHLCV** | yfinance (`.IS` suffix) | `isyatirimhisse.fetch_stock_data` | `fixtures/price/<TICKER>.json` | 15 dk |
| **Technical Worker — İndikatör** | pandas-ta (lokal hesap) | — | — | — |
| **Technical Worker — Endeks** | yfinance (`XU100`) | `isyatirimhisse.fetch_index_data` | `fixtures/index/` | 15 dk |
| **Fundamental Worker — KAP filings** | **MKK API Portal** | KAP RSS | `fixtures/kap/<TICKER>.json` | 1 saat |
| **Fundamental Worker — Finansal tablo** | **`isyatirimhisse.fetch_financials`** | yfinance financials | `fixtures/fin/<TICKER>/Q<N>.json` | 24 saat |
| **Fundamental Worker — Analist tavsiyesi** | borsapy | — (yok) | `fixtures/analyst/<TICKER>.json` | 24 saat |
| **Fundamental Worker — Peer compare** | borsapy scanner | isyatirimhisse manuel agregasyon | `fixtures/peers/<SQUAD>.json` | 24 saat |
| **Fundamental Worker — Temettü geçmişi** | yfinance | isyatirimhisse | `fixtures/dividend/` | 24 saat |
| **News (Synthesizer prompt context)** | Mynet scrape | Bigpara scrape | `fixtures/news/<TICKER>.json` | 1 saat |
| **Memory Agent — embedding** | text-embedding-3-large | — | — | — |
| **Memory Agent — similarity read** | pgvector cosine (lokal DB) | — | — | — |

### 3.1 Squad-Spesifik Kaynak Notları

| Squad | Primary fundamental kaynak | Özel notlar |
|---|---|---|
| **Banking** | isyatirimhisse (XI_29) | NIM, NPL, SYR, CASA — banka raporlamasından özel hesap |
| **Energy** | isyatirimhisse + KAP filings | Refining margin → Brent korelasyonu (yfinance BZ=F) |
| **Defense** | KAP filings (MKK API) + isyatirimhisse | Backlog için KAP sözleşme bildirimi; R&D oranı için IFRS |
| **Retail** | isyatirimhisse | LFL büyüme, mağaza sayısı — operasyonel KPI'lar |
| **RealEstate** | isyatirimhisse + KAP | NAV iskonto için ekspertiz raporları KAP'tan |
| **Generic** | isyatirimhisse + yfinance | P/E, P/B, ROE, EBITDA temel oranlar |

---

## 4. Karar Gerekçeleri

### 4.1 Niye yfinance fiyat için primary, isyatirim secondary?

- yfinance daha geniş tarihsel veri (10+ yıl), daha basit API, ekosistem standardı.
- isyatirim BIST'e özel ve auth'suz → Yahoo politika değiştirir veya kapatırsa **canlı yedek**.
- Her ikisi de ücretsiz, ikisini de kullanmak provider chain'in tek bayrak değişimiyle anlık fail-over yapmasını sağlar.

### 4.2 Niye isyatirim finansal tablo için primary, yfinance secondary?

- **yfinance Türk şirket finansallarında güvenilmez:** Çoğu zaman son 4 çeyrek bile gelmez; para birimi karışıklığı (TRY vs USD reporting), eksik satırlar.
- **isyatirim ham IFRS verir:** XI_29 (eski), IFRS, IFRS_K (konsolide) formatlarında çeyreklik tablo.
- Banking squad (NIM/NPL), Energy squad (refining margin) için **ham satır lazım**, yfinance'in türetilmiş özeti yetmez.
- isyatirim ölürse yfinance çoğu hisse için **yine de bir şeyler** verir → degrade kabul edilebilir.

### 4.3 Niye MKK API primary, RSS secondary?

- MKK API **resmi REST + structured JSON** — geriye dönük sorgu, filtre, kategori desteği.
- RSS sadece **son N bildirim** verir, tarih aralığı sorgusu yok, kategori filtresi yok.
- MKK onay gecikme riski var → RSS hayat kurtarır, Gün 3'e kadar onay gelmezse MKK v1.1'e ertelenir.
- KAP RSS resmi public ama "API garantisi" yok → MKK ile aynı veriyi resmi sözleşmeli kanaldan almak daha sağlam.

### 4.4 Niye hem borsapy hem isyatirim?

Komplementer:

| | borsapy | isyatirimhisse |
|---|---|---|
| Hisse fiyatı | ✅ | ✅ |
| Finansal tablo | ⚠️ Sınırlı | ✅ Tam IFRS |
| Analist tavsiyesi | ✅ | ❌ |
| Scanner / filtreleme | ✅ | ❌ |
| Endeks verisi | ⚠️ | ✅ |

Tek paket yetmiyor → ikisinin güçlü tarafını farklı tool'larda kullanırız. İkisi de IP ban riski taşıdığı için cache + 1 req/sn politikası kritik.

### 4.5 Niye Mynet/Bigpara hala scrape (alternatif yok mu)?

- Türkiye'de **ücretsiz Türkçe haber API'si yok** (NewsAPI Türkçe içeriği zayıf, ücretli).
- Sentiment Worker hackathon scope'undan çıkarıldı (v2) → news sadece **context** olarak Synthesizer'a inject edilir.
- Scrape: cache 1 saat, fixture 48 saat → demo'da canlı isteğe gerek yok.

### 4.6 Niye borsa-mcp'yi MCP olarak entegre etmedik?

- Sidecar süreç eklemek hackathon karmaşıklığını artırır (deploy, debug, healthcheck).
- Strands zaten ajan orchestrasyon yapıyor → ikinci orchestrasyon katmanı (MCP server) gereksiz.
- Onun yerine **aynı endpoint'leri kullanan PyPI paketlerini** kendi `providers/` katmanımızda wrap'liyoruz. Tek süreç, tek deploy.
- Yine de borsa-mcp **referans olarak** okundu → hangi endpoint'lerin stabil olduğunu öğrenmek için.

---

## 5. DataProvider Interface ve Registry

### 5.1 Base Interface

```python
# backend/providers/base.py
from typing import Protocol, Any

class DataProvider(Protocol):
    name: str

    async def fetch(self, key: str, **kwargs) -> dict[str, Any]:
        """Returns provider-specific payload or raises ProviderError."""
        ...

class ProviderError(Exception):
    """Provider failed; chain should try next."""

class DataUnavailable(Exception):
    """All providers in chain failed."""
```

### 5.2 ChainedDataProvider

BLUEPRINT.md D.2'deki implementasyon aynen geçerli:

```python
# backend/providers/chained.py
import asyncio
import structlog

logger = structlog.get_logger()

class ChainedDataProvider:
    """primary → secondary → fixture (last_known_good)"""

    def __init__(self, *providers: DataProvider, timeout: float = 10.0):
        self.providers = providers
        self.timeout = timeout

    async def fetch(self, key: str, **kwargs) -> dict:
        last_err = None
        for p in self.providers:
            try:
                result = await asyncio.wait_for(
                    p.fetch(key, **kwargs), timeout=self.timeout
                )
                if not is_demo_mode():
                    await fixture_writer.snapshot(key, p.name, result)
                return result
            except Exception as e:
                last_err = e
                logger.warning(
                    "provider_failed",
                    provider=p.name, key=key, err=str(e)
                )
        raise DataUnavailable(key) from last_err
```

### 5.3 Registry (Tek Truth)

```python
# backend/providers/registry.py
from .chained import ChainedDataProvider
from .impl import (
    TcmbEvdsProvider, TcmbInflationProvider,
    MkkApiProvider, KapRssProvider,
    YfinanceProvider, IsyatirimPriceProvider, IsyatirimFinancialsProvider,
    YfinanceFinancialsProvider,
    BorsapyAnalystProvider, BorsapyScannerProvider,
    MynetScraperProvider, BigparaScraperProvider,
)
from .fixtures import FixtureProvider

PROVIDER_CHAINS = {
    "macro":      ChainedDataProvider(TcmbEvdsProvider(),  TcmbInflationProvider(), FixtureProvider("macro")),
    "price":      ChainedDataProvider(YfinanceProvider(),  IsyatirimPriceProvider(), FixtureProvider("price")),
    "kap":        ChainedDataProvider(MkkApiProvider(),    KapRssProvider(),         FixtureProvider("kap")),
    "financials": ChainedDataProvider(IsyatirimFinancialsProvider(), YfinanceFinancialsProvider(), FixtureProvider("fin")),
    "analyst":    ChainedDataProvider(BorsapyAnalystProvider(), FixtureProvider("analyst")),
    "peers":      ChainedDataProvider(BorsapyScannerProvider(), FixtureProvider("peers")),
    "news":       ChainedDataProvider(MynetScraperProvider(), BigparaScraperProvider(), FixtureProvider("news")),
}

async def fetch(domain: str, key: str, **kwargs):
    return await PROVIDER_CHAINS[domain].fetch(key, **kwargs)
```

Agent'lar şöyle çağırır:

```python
# Fundamental Worker tool
from providers.registry import fetch

async def fetch_kap_filings(ticker: str, days: int = 30):
    return await fetch("kap", f"{ticker}:filings:{days}d")
```

### 5.4 Mode Bayrakları

Environment variable üzerinden:

- `THESISFORGE_MODE=production` — normal chain
- `THESISFORGE_MODE=fixture` — sadece fixture provider'ı koşar (LLM-free integration test)
- `THESISFORGE_MODE=demo` — fixture priority + fixture writer kapalı (demo kill-switch)

---

## 6. Onboarding / Kayıt Prosedürleri

> **Sprint Gün 1 görevidir.** B (Data Lead) sabah 09:00'da başlatır. Onay gecikme riski olan API'leri **ilk önce** yap.

### 6.1 TCMB EVDS

1. `https://evds2.tcmb.gov.tr` → **"Üye Ol"**
2. E-posta + telefon doğrulama (~5 dk, otomatik)
3. Login → **"Profil" → "API Anahtarı" → "Anahtar Oluştur"**
4. `.env`:
   ```
   TCMB_EVDS_KEY=xxxxxxxxxxxxxxxx
   ```
5. Smoke test:
   ```bash
   curl "https://evds2.tcmb.gov.tr/service/evds/series=TP.AB.A01&startDate=01-01-2026&endDate=01-05-2026&type=json&key=$TCMB_EVDS_KEY"
   ```
6. Önemli seri kodları:
   - `TP.DK.USD.A.YTL` — USD/TRY günlük
   - `TP.AB.A01` — TÜFE aylık
   - `TP.PY.P01.TRY` — TCMB politika faizi
   - `TP.MK.F.BIST` — BIST 100

### 6.2 MKK API Portal (yeni — kritik)

1. `https://apiportal.mkk.com.tr/` → **"Üye Ol"** (sayfa JHipster app, hata gelirse `/login` direkt dene)
2. E-posta + telefon doğrulama
3. **Hesap onayı bekle** — süre belirsiz; başvuruyu **Gün 1 sabahı 09:00'da** yap. Onay gelmediyse `kapdestek@mkk.com.tr` ile temas.
4. Login → **"Uygulamalarım" → "Yeni Uygulama"**
5. **API Key kopyala:**
   ```
   MKK_API_KEY=xxxxxxxxxxxxxxxx
   ```
6. **"KAP Bildirim" servisine abone ol** (12 servisten birisi — tam liste portala girince görünür).
7. Test endpoint çağrısı (doküman portala girince inilebilir; PDF: `https://kap.org.tr/tr/api/about/content-file/8a019492945fbe080194b26d8bed4873`).
8. **Plan B onay gecikirse:** Gün 3'e kadar onay yoksa **KAP RSS primary'de kalır**, MKK v1.1'e ertelenir. Risk tablosu #14'e yazıldı.

### 6.3 TwelveData free tier (opsiyonel)

1. `https://twelvedata.com/` → sign up
2. Free tier: 8 req/dk, 800 req/gün
3. `.env`:
   ```
   TWELVEDATA_KEY=xxxxxxxxxxxxxxxx
   ```
4. Yalnızca BIST fiyatı için 3. fallback olarak. Hackathon için zorunlu değil.

### 6.4 PyPI Paketleri (kayıt yok)

```bash
pip install yfinance pandas-ta isyatirimhisse borsapy beautifulsoup4 playwright httpx
playwright install chromium  # Mynet/Bigpara scrape için
```

Smoke testler:

```python
# isyatirim
from isyatirimhisse import fetch_stock_data
df = fetch_stock_data("THYAO", "01-01-2026", "01-05-2026")
print(df.head())

# borsapy (analyst recommendation örneği)
import borsapy
# README'den exact API'ye bak

# yfinance
import yfinance as yf
print(yf.Ticker("ASELS.IS").history(period="3mo").tail())
```

### 6.5 OpenAI (Memory embedding)

1. `https://platform.openai.com/` → API key
2. `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```
3. `text-embedding-3-large` modeline erişim default'ta açık.

---

## 7. Fallback Senaryoları

> **Gün 6 testi:** Aşağıdaki senaryoların hepsi `pytest tests/test_fallback.py` ile doğrulanır.

| # | Senaryo | Beklenen Davranış |
|---|---|---|
| 1 | yfinance 5xx döner | `IsyatirimPriceProvider` devralır → fiyat gelir |
| 2 | yfinance + isyatirim ikisi de 5xx | `FixtureProvider("price")` 48 saatlik snapshot döner |
| 3 | MKK API timeout (>10s) | `KapRssProvider` devralır → son 50 bildirim gelir |
| 4 | MKK + RSS ikisi de ölü | `FixtureProvider("kap")` snapshot |
| 5 | isyatirim financial 404 (yeni hisse) | `YfinanceFinancialsProvider` devralır |
| 6 | Hepsi ölü | `DataUnavailable` → Synthesizer "veri eksik, confidence cap'lendi" notu ekler |
| 7 | TCMB EVDS rate limit (429) | exponential backoff (1s, 2s, 4s) → 3. denemede secondary |
| 8 | Mynet anti-bot (Cloudflare challenge) | Bigpara → fixture |
| 9 | Tüm chain başarılı ama validation fail | `ProviderError` → next provider |

**Demo mode davranışı:** `THESISFORGE_MODE=demo` iken fixture provider primary olur → tüm pipeline tahmin edilebilir hızda çalışır (<8s pre-warmed).

---

## 8. Cache & TTL Tablosu

Redis tek truth (`BLUEPRINT.md F.2` ile uyumlu, burada veri-merkezli yeniden organize):

| Veri | TTL | Redis Key Pattern | Davlumbaz (invalidation) |
|---|---|---|---|
| Makro context | 15 dk | `macro:context` | TTL doğal |
| BIST endeks | 15 dk | `macro:bist` | TTL doğal |
| OHLCV (90d) | 15 dk | `price:<TICKER>:ohlcv:90d` | TTL doğal |
| Endeks (90d) | 15 dk | `price:<INDEX>:ohlcv:90d` | TTL doğal |
| Finansal tablo (çeyreklik) | 24 saat | `fin:<TICKER>:<Q>` | KAP yeni filing → manuel invalidate |
| KAP bildirim (30d) | 1 saat | `kap:<TICKER>:filings:30d` | Yeni filing webhook (v2) |
| Analist tavsiyesi | 24 saat | `analyst:<TICKER>` | TTL doğal |
| Peer agregasyonu | 24 saat | `peers:<SQUAD>` | TTL doğal |
| Temettü geçmişi | 24 saat | `dividend:<TICKER>` | TTL doğal |
| Haber | 1 saat | `news:<TICKER>`, `news:macro` | TTL doğal |
| Demo pre-warm | ∞ (demo süresi) | `demo:warm:<TICKER>` | Manuel cron |
| Agent state | session boyu | `agent:state:<session_id>` | Session bitince |
| Rate limit counter (Gemini) | 60s | `ratelimit:gemini:<minute>` | TTL doğal |

**Fixture (disk) ek TTL:** Her başarılı `fetch()` sonrası 48 saatlik snapshot diske yazılır. Demo'dan önce `scripts/refresh_fixtures.py` ile manuel yenilenir.

---

## 9. Rate Limit & Politeness Politikası

| Kaynak | Talep limiti (uygulamamız) | User-Agent | 429 davranışı |
|---|---|---|---|
| TCMB EVDS | 60 req/dk (resmi 300, pratikte düşük tut) | `ThesisForge/0.1 (contact: kapdestek@example.com)` | Exponential backoff: 1s, 2s, 4s |
| MKK API | Doc'tan teyit (başvuru sonrası) | aynı | Aynı |
| isyatirim | **≤1 req/sn**, paralel istek yok | aynı | Backoff + secondary fail-over |
| borsapy | **≤1 req/sn** | aynı | Backoff + cache derinleştir |
| yfinance | Yahoo'nun implicit limiti | yfinance default | Backoff + secondary |
| Mynet/Bigpara scrape | **≤1 req/sn**, `robots.txt` saygısı | aynı | Cloudflare challenge'da Playwright stealth, sonra fixture |
| OpenAI embedding | Tier 1 RPM uyumlu | OpenAI SDK default | SDK kendi backoff yapar |
| Gemini (LLM) | Cache + Flash öncelik | SDK default | Kill-switch tetikle |

**Genel kurallar:**
- Her HTTP istek `httpx.AsyncClient` üzerinden, default timeout 10s, retry 3.
- 429 / 503 yanıtlarında **exponential backoff** (1s, 2s, 4s) maksimum 3 deneme.
- Scrape için **belirgin User-Agent** + iletişim adresi: aracı kuruluş bizi engellemek isterse ulaşabilmeli (etik scrape).
- IP rotation yok — eğer engellenirsek fixture'a düşeriz; demo'da problem yaşamamak için pre-warm.

---

## 10. Lisans ve Atıf

| Kaynak / Paket | Lisans | Atıf Yeri |
|---|---|---|
| `yfinance` | Apache 2.0 | `README.md` Credits |
| `pandas-ta` | MIT | README Credits |
| `isyatirimhisse` | MIT | README Credits + kod yorumu (auth'suz endpoint sahibi: İş Yatırım) |
| `borsapy` | MIT | README Credits |
| `borsa-mcp` | MIT | README: *"Inspiration: borsa-mcp by saidsurucu — referans olarak okundu, kod kopyalanmadı."* |
| TCMB EVDS | Resmi devlet API — kullanım şartları sayfaya bağlı | Tez içinde `[kaynak: TCMB EVDS]` |
| MKK API | Resmi MKK servisi — ToS portal kayıt sırasında | Tez içinde `[kaynak: KAP]` |
| KAP RSS | Public, resmi | Tez içinde `[kaynak: KAP]` |
| Mynet / Bigpara | Public web, scrape | Haber alıntısında URL backlink |

**Hackathon (BTK 26) durumu:** 3rd-party MIT/Apache kütüphane kullanımı serbest. Sadece atıf yeterli. Sıfırdan yazma şartı yok; eğer olsaydı isyatirim/borsapy'yi de scrape eden kendi modülümüzü yazardık.

---

## 11. Bilinen Riskler ve Açık Sorular

### Risk Listesi (BLUEPRINT.md I tablosunu tamamlar)

| # | Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|---|
| V1 | MKK API onay süresi 7 günden uzun | Orta | Orta | KAP RSS primary'de kalır, MKK v1.1'e ertelenir |
| V2 | isyatirim endpoint formatı değişir | Düşük | Yüksek | 48 saat fixture snapshot, secondary olarak yfinance |
| V3 | isyatirim IP-ban (aşırı request) | Düşük | Yüksek | 1 req/sn + cache + agresif fixture |
| V4 | Mynet Cloudflare anti-bot | Orta | Düşük | Bigpara fallback + fixture |
| V5 | yfinance Yahoo politika değişir | Düşük | Yüksek | isyatirim secondary aktif |
| V6 | TCMB EVDS rate limit'e takılırız | Düşük | Orta | 60/dk hard cap, Redis counter |
| V7 | borsapy ile isyatirimhisse aynı IP'den çağırırsak çift ban | Orta | Yüksek | Tek `httpx` session, request rate ortak hesap |
| V8 | KAP finansal tablo PDF parse hatası (KAP filings) | Yüksek | Düşük | isyatirim primary olduğu için KAP filings sadece haber/sözleşme bildirimi için → PDF parse'a gerek yok |

### Açık Sorular

1. **MKK API'nin tam endpoint kataloğu?** Portal kaydı tamamlanınca 12 servisin tam listesi netleşecek. İlgilendiklerimiz: "KAP Bildirim", "Şirket Bilgi", "Sözleşme Bildirimleri".
2. **MKK API rate limit?** Doc'ta yazıyor olmalı, başvuru sonrası teyit edilecek.
3. **isyatirim "financials" çıktı şeması Türkçe mi İngilizce mi?** Hızlı sanity check ile `compute_ratios()` için kolon adı map'i lazım (büyük olasılıkla Türkçe).
4. **borsapy peer scanner sektör eşleştirme bizim `sector_map.yaml` ile uyumlu mu?** Gün 3'te doğrula.

---

## 12. v2 Roadmap (Veri Katmanı)

Hackathon dışı, v2'ye atılan kaynak/özellikler:

- **TEFAS BindHistoryInfo / BindHistoryAllocation** — 800+ Türk yatırım fonu, fon-bazlı tez için
- **Foreks / Matriks lisansı** — real-time tick data (aylık ₺500-5000)
- **BIST VERDA API** — resmi lisanslı kaynak (gerçek production için)
- **Bank API portals** (Yapı Kredi, Vakıfbank) — BIST endeks fiyatı, yfinance secondary alternatifi
- **Reddit `r/borsaistanbul`** — Sentiment Worker geldiğinde
- **Ekşi Sözlük başlık tracker** — Türkçe sentiment için
- **Telegram public kanalları** — community pulse
- **Backtest tarihi kilidi** — tüm provider'lara `as_of_date` parametresi (time-leakage savunması)
- **Webhook tabanlı KAP invalidation** — yeni filing geldiğinde cache anında invalidate (şu an 1 saat TTL)
- **CDN cache layer** — fixture'ları S3'e replicate, dünya çapında düşük latency

---

## EK — Hızlı Referans

**"Bir hisse için tam tez üretirken kaç farklı kaynağa gidiyoruz?"**

ASELS örneği (default mode, cache miss):

1. TCMB EVDS — makro paragraf (1 çağrı)
2. yfinance — OHLCV 90d (1 çağrı)
3. pandas-ta — indikatörler (lokal)
4. MKK API — KAP filings 30d (1 çağrı)
5. isyatirim — son 4 çeyrek finansal (1 çağrı)
6. borsapy — analist tavsiyesi (1 çağrı)
7. borsapy — sektör peer scanner (1 çağrı)
8. yfinance — temettü geçmişi (1 çağrı)
9. Mynet — son 10 haber (1 çağrı)
10. text-embedding-3-large — yeni sorgu embed (1 çağrı)
11. pgvector — top_k=3 similarity (lokal DB)

**Toplam:** ~9 dış istek + 2 lokal. Hepsi 15 dk Redis cache'i geçerse demo'da 0 dış istek.
