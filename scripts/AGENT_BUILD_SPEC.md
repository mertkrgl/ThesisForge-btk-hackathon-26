# ThesisForge — Strands Agent Katmanı İnşa Spesifikasyonu

> **Hedef okuyucu:** Bu dosyayı bir AI kodlama asistanına vereceksin. Asistan bu dosyayı okuyup `scripts/product/` altındaki hazır veri çekme fonksiyonlarını Strands tabanlı bir 8-ajan pipeline'ına dönüştürecek.
>
> **Branch durumu:** `spike/data-probe` veri API'lerini test etti, `product/` modüllerine sarmaladı. Agent kodu **yok**. Bu spec agent kodunu nasıl yazacağını söyler.
>
> **İlgili truth file'lar:** `BLUEPRINT.md`, `docs/agents.md`, `docs/architecture.md`, `docs/data.md`, `docs/database.md`, `docs/flows.md`, `docs/stack.md`, `docs/sprint.md`, `docs/testing.md`, `docs/risks.md`, `docs/demo.md`, `docs/product.md`, `scripts/DATA_LAYER.md`
>
> Son güncelleme: 2026-05-13 · Sürüm 2.0 (Strands API doğrulandı + boşluklar kapatıldı)

---

## 0. TL;DR — Yapılacak İş

1. `scripts/product/*` altındaki 9 Python modülü hisse başına TÜM veriyi çekiyor. Tek giriş: `thesis_bundle.build_thesis_bundle(ticker)` (sync, ~35s).
2. Bu fonksiyonları **Strands `@tool` decorator'ı** ile wrap'le, her çağrıyı **`tool_call_logs`** tablosuna **UUID `call_id`** ile yaz (citation provenance).
3. **8 ajanı** Strands ile kur (2 Pro + 6 Flash, Gemini 2.5). Orkestrasyon: 3-bacak paralel → 2-Worker paralel → Devil → Synthesizer → Citation Validate → DB persist.
4. Çıktılar **Pydantic schema** ile structured (`structured_output_model` call-time parametresi). Synthesizer streaming Markdown üretir, her claim'e `[kaynak: <call_id>]` ekler.
5. Eksik 4 alt-sistem: `sector_map.yaml`, Memory (OpenAI embedding + pgvector), Citation Validator, async bundle.

### 0.1 Strands SDK — Kritik API Düzeltmeleri (sürüm 1.0+)

> **Spec'i implemente eden AI'a:** Aşağıdaki API noktalarına KESİNLİKLE uyun. Eski sürüm 1.0'da bu isimler farklıydı; resmi `strands-agents` v1.0+ kullanıyoruz.

| Yanlış (eski sözde-kod) | Doğru (Strands 1.0+) |
|---|---|
| `Agent(output_model=Schema)` | Call-time: `result = await agent.invoke_async(prompt, structured_output_model=Schema)` → `result.structured_output` |
| `Agent(streaming=True)` | Method: `async for event in agent.stream_async(prompt): ...` |
| `Agent(max_tool_calls=5)` | `Agent(max_iterations=5)` (iteration ≈ tool call sayısı) |
| `await agent.run(...)` | `await agent.invoke_async(...)` veya sync `agent(...)` |
| `model="gemini-2.5-flash"` (string) | `from strands.models import GeminiModel; model=GeminiModel(client_args={"api_key": GOOGLE_API_KEY}, model_id="gemini-2.5-flash", params={...})` |
| `agent.tools=[fn1, fn2]` | Tools `@tool` decorator ile fn objesi; constructor'a liste olarak verilir |

**Install:** `pip install strands-agents strands-agents-tools`

**Multi-model destek:** Her ajan kendi `GeminiModel` instance'ı ile init edilir; bir process içinde Pro ve Flash karışık kullanılır.

---

## 1. Mevcut Veri Katmanının Anatomi'si (`scripts/product/`)

### 1.1 Modüller ve Public API

Tüm modüller `scripts/product/__init__.py` üzerinden re-export edilir. **Hiçbir agent doğrudan HTTP yapmaz** — sadece bu fonksiyonları çağırır.

#### `macro.py` → **Macro Context Agent**

| Fonksiyon | Auth | İmza | Dönen Şekil |
|---|---|---|---|
| `get_macro_context()` | TCMB EVDS key | `() -> dict` | `{"usd_try": float, "eur_try": float, "tufe_last": float, "policy_rate": float, "as_of": "dd-mm-yyyy"}` |
| `get_series(series_code, start, end)` | TCMB EVDS key | `(str, str, str) -> list[dict]` | TCMB ham seri (her satır 1 tarih) |

**Seri kodları (modül sabiti):** `SERIES_USD_TRY="TP.DK.USD.A.YTL"`, `SERIES_EUR_TRY="TP.DK.EUR.A.YTL"`, `SERIES_TUFE="TP.AB.A01"`, `SERIES_POLICY_RATE="TP.APIFON4"`.

**Önemli:** TCMB API `header: key=<KEY>` ister; `?key=` query parametresi **artık çalışmıyor** (5 Nisan 2024 değişikliği). Base URL: `https://evds3.tcmb.gov.tr/igmevdsms-dis`. **`tufe_last` HAM endeks değeridir** (ör. 10882.47) — agent'a vermeden önce YoY %'ye çevir (§10.3).

#### `companies.py` → **Tüm agent'lar (referans veri)**

| Fonksiyon | Auth | İmza | Dönen Şekil |
|---|---|---|---|
| `get_bist_companies()` | MKK Basic | `() -> DataFrame` | ~704 satır: `id, title, stockCode, memberType, kfifUrl` |
| `get_company_by_ticker(ticker)` | MKK Basic | `(str) -> dict \| None` | `{"id": "1107", "title": "...", "stockCode": "THYAO", "memberType": "IGS", "kfifUrl": "..."}` |
| `get_all_members()` | MKK Basic | `() -> DataFrame` | 1037 satır |
| `get_funds()` | MKK Basic | `() -> DataFrame` | 3467 fon |

**Auth:** `Authorization: Basic <base64(MKK_API_KEY:MKK_API_SECRET)>`. **`generateToken` endpoint 401 dönüyor — kullanma**. Base URL: `https://apigwdev.mkk.com.tr`.

#### `prices.py` → **Technical Worker**

| Fonksiyon | İmza | Dönen Şekil | Provider Chain |
|---|---|---|---|
| `get_ohlcv(ticker, days=90)` | `(str, int) -> DataFrame` | OHLCV (Date index), `df.attrs["source"] = "yfinance"\|"isyatirim"` | yfinance → isyatirim → **RuntimeError** |
| `get_index(code="XU100", days=90)` | `(str, int) -> DataFrame` | Endeks OHLCV | yfinance → isyatirim |
| `get_dividends(ticker)` | `(str) -> pd.Series` | Tarihli temettü | yfinance |
| `get_brent_oil(days=30)` | `(int) -> DataFrame` | `BZ=F` OHLCV — **Energy squad** | yfinance |

**`.IS` suffix BIST için yfinance'ta zorunlu** (modül otomatik ekler). Hata yönetimi §C.7.

#### `financials.py` → **Fundamental Worker**

| Fonksiyon | İmza | Dönen Şekil |
|---|---|---|
| `get_financials(ticker, years=2, financial_group="1", exchange="TRY")` | `(str, int, str, str) -> DataFrame` | Satırlar finansal kalem (Türkçe IFRS adları), kolonlar çeyrekler (`"2024/3"` …). `df.attrs["financial_group"]` |
| `get_latest_quarter(ticker)` | `(str) -> dict` | `{"period": "2026/3", "ticker": "...", "Dönen Varlıklar": "485646000000", ...}` |
| `compute_basic_ratios(ticker)` | `(str) -> dict` | `{"cari_oran": 0.97, "borc_ozkaynak": 1.23, "aktif_toplam": float, "period": "..."}` |

**Financial group:** `"1"` = XI_29 (eski), `"2"` = UFRS, `"3"` = UFRS_K. Modül otomatik fallback. **Sayılar STRING geliyor** (`"485646000000"`) — tool wrapper'da `float` cast + format normalize (§10).

#### `disclosures.py` → **Fundamental Worker**

| Fonksiyon | Auth | İmza | Dönen Şekil |
|---|---|---|---|
| `get_last_disclosure_id()` | MKK Basic | `() -> int` | Son bildirim ID |
| `get_disclosure_detail(id)` | MKK Basic | `(int) -> dict` | `{"disclosureIndex": "...", "senderTitle": "...", "subject": {"tr":..,"en":..}, "summary": {...}, "time": "12.05.2026 10:30", ...}` |
| `get_latest_disclosures(count=20)` | MKK Basic | `(int) -> list[dict]` | Son N detay |
| `get_company_disclosures(ticker, days=30)` | yok (pykap) | `(str, int) -> list[dict]` | pykap parsed list |

**Pykap dönüş şeması:** Field adları **runtime'da doğrulanmalı** — `bundle_tool` içinde `d.get("publishDate") or d.get("date") or d.get("publishedAt")` defensive lookup yap. `thesis_bundle.py` satır 109'da `publishDate` kullanılıyor; pykap sürümü farklıysa düzeltme gerekir.

#### `analyst.py` → **Fundamental Worker**

| Fonksiyon | İmza | Dönen Şekil |
|---|---|---|
| `get_recommendation(ticker)` | `(str) -> dict` | `{"recommendation": "AL"\|"TUT"\|"SAT", "target_price": 455.0, "upside_potential": 48.81}` veya `{}` (None hardening) |
| `get_quick_info(ticker)` | `(str) -> dict` | borsapy info dict |
| `search_sector(keyword)` | `(str) -> list[str]` | `["AKBNK", "GARAN", ...]` |
| `get_fx_rate(currency="USD")` | `(str) -> dict` | `{"symbol": "USD", "last": 45.36, ...}` |

**None handling:** `get_recommendation` bazen `None` döner; tool wrapper içinde `or {}` ile sarmala.

#### `technicals.py` → **Technical Worker** (network yok, lokal hesap)

| Fonksiyon | İmza | Dönen Şekil |
|---|---|---|
| `compute_indicators(ohlcv: DataFrame)` | `(DataFrame) -> dict` | `{"last_close", "rsi_14", "macd", "macd_signal", "macd_hist", "bb_upper/middle/lower", "atr_14", "sma_20/50", "ema_12", "volume_avg_20"}` |
| `technical_signal(indicators: dict)` | `(dict) -> dict` | `{"trend": "bullish"\|"bearish"\|"neutral", "momentum": "overbought"\|"oversold"\|"neutral", "volatility": "high"\|"normal"\|"low"}` |

**Eksik (yazılacak):** `detect_patterns()`, `find_support_resistance()`, `relative_strength()` — `backend/services/technicals_extra.py`'de implemente edilecek (§C.10 squad-specific hesaplar bölümü).

#### `news.py` → **Fundamental + Synthesizer + Macro**

| Fonksiyon | İmza | Dönen Şekil |
|---|---|---|
| `get_company_news(ticker, count=10, with_summary=False, days=30)` | `(str, int, bool, int) -> list[dict]` | `[{"title", "source", "date" (RFC), "url", "snippet", "summary"?, "real_url"?, "published_at"?}, ...]` |
| `get_market_news(count=10)` | `(int) -> list[dict]` | Aynı şekil |
| `get_news_detail(news_url)` | `(str) -> dict` | `{"title", "date", "summary", "real_url"}` |

**Kritik uyarılar:**
- `get_company_news` MKK'da yoksa `ValueError` atar → tool wrapper try/except.
- 1 saniye **global** rate-limit (`news.py:_MIN_INTERVAL=1.0`) — `with_summary=True` ise 8 haber × 1s = ~8s blocking. Agent branch'inde **async httpx + Semaphore(2)** ile yeniden yaz (§20).
- `gnewsdecoder` Google obfuscated URL'i çözer.

#### `thesis_bundle.py` → Orchestrator'ın tek başlangıç çağrısı

```python
def build_thesis_bundle(ticker: str, days: int = 90) -> dict
```

Tüm modülleri tek bundle'da toplar. **Sync ve sıralı çağrılar** → ~35s blocking. Agent branch'inde §20'deki **async refactor** zorunlu (hedef 12-15s). Bundle şeması §3.1.

### 1.2 Konfigürasyon

`scripts/product/config.py`:

```python
TCMB_EVDS_KEY = os.getenv("TCMB_EVDS_KEY", "")
MKK_API_KEY   = os.getenv("MKK_API_KEY", "")
MKK_API_SECRET = os.getenv("MKK_API_SECRET", "")
TCMB_BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis"
MKK_BASE  = "https://apigwdev.mkk.com.tr"
DEFAULT_TIMEOUT = 15
USER_AGENT = "ThesisForge/0.1"
```

Loader path: `_root = Path(__file__).parent.parent.parent` → proje root.

**Agent branch geçişi:**
1. `.env.probe` dosyasını proje root'unda `.env` olarak kopyala.
2. `backend/config/settings.py` Pydantic Settings ile **centralize** et:

```python
# backend/config/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    TCMB_EVDS_KEY: str
    MKK_API_KEY: str
    MKK_API_SECRET: str
    GOOGLE_API_KEY: str
    OPENAI_API_KEY: str
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"
    THESISFORGE_MODE: str = "production"  # production | fixture | demo
    LOG_LEVEL: str = "INFO"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""

settings = Settings()
```

3. `scripts/product/config.py` aynı `.env`'i okur — değişiklik gerekmez.

### 1.3 Bağımlılıklar (`requirements.txt`)

```
# product/* mevcut
httpx>=0.27, pandas>=2.2, python-dotenv>=1.0, rich>=13.0
yfinance>=0.2.40, isyatirimhisse>=4.0, borsapy>=0.5
pykap>=0.4, pandas-ta>=0.3, beautifulsoup4>=4.12, googlenewsdecoder>=0.1

# Agent stack — yeni
strands-agents>=1.0
strands-agents-tools>=1.0
google-generativeai>=0.8
openai>=1.40                      # text-embedding-3-large

# Web framework
fastapi>=0.115
uvicorn[standard]>=0.32
pydantic>=2.9
pydantic-settings>=2.5

# Persistence
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29
alembic>=1.13
pgvector>=0.3
redis[hiredis]>=5.0

# Scheduler
apscheduler>=3.10

# Observability
opentelemetry-api>=1.27
opentelemetry-sdk>=1.27
opentelemetry-exporter-otlp>=1.27
structlog>=24.4

# Test
pytest>=8.3, pytest-asyncio>=0.24, pytest-cov>=5.0, pytest-mock>=3.14
```

`pip install -e .` sonrası `pip check` — conflict yoksa devam.

---

## 2. 8 Ajan — Hangi Veri Hangi Ajan İçin

`docs/agents.md §1` tablosunun tool-odaklı versiyonu:

| # | Ajan | Tip | Model | Çağıracağı Tool'lar |
|---|---|---|---|---|
| 1 | Macro Context | Background | Flash | `get_macro_context`, `get_market_news` |
| 2 | Orchestrator | Coordinator | Flash | `build_thesis_bundle_async` (bir kez) + agent dispatch |
| 3 | Sector Router | Classifier | Flash | `lookup_sector` (static) + LLM fallback |
| 4 | Technical Worker | Worker (parallel) | Flash | `get_ohlcv`, `compute_indicators`, `get_index`, `relative_strength` (yeni), `find_support_resistance` (yeni) |
| 5 | Fundamental Worker | Worker (parallel, squad-aware factory) | Flash | `get_disclosures`, `get_financials`, `compute_ratios`, `get_recommendation`, `get_dividends`, `get_company_news`, `search_sector`, `get_brent_oil` (Energy) |
| 6 | Devil's Advocate | Critic | **Pro** | **Veri çekmez**; `memory_base_rate` + worker output sorgular |
| 7 | Synthesizer | Composer | **Pro** | **Veri çekmez**; streaming Markdown |
| 8 | Memory | Stateful | Flash + `text-embedding-3-large` | `memory_search`, `memory_write`, gece cron'da `get_ohlcv` |

**Model dağılımı:** Pro x2 (Devil + Synthesizer), Flash x6. Tier 1 paid plan ($1.25/M Pro input, $0.075/M Flash). Hackathon bütçesi: $10-20.

---

## 3. Veri Akışı — Bundle Şeması ve Agent Eşleşmesi

### 3.1 `build_thesis_bundle(ticker)` Çıktı Şeması (normalize edilmiş)

```python
{
  "ticker": "THYAO",
  "fetched_at": "2026-05-12T20:30:00",
  "macro": {
    "usd_try": 45.29, "eur_try": 53.30,
    "tufe_last_index": 10882.47,        # ham endeks
    "tufe_yoy_pct": 39.2,               # YoY hesabı — §10.3 ile eklenmiş
    "policy_rate": 40.0,
    "as_of": "2026-05-12"               # ISO format — normalize
  },
  "company": {
    "id": "1107", "title": "TÜRK HAVA YOLLARI A.O.",
    "stockCode": "THYAO", "memberType": "IGS", "kfifUrl": "..."
  },
  "price": {
    "source": "yfinance", "rows": 63,
    "last_close": 305.75, "first_close": 337.0,
    "change_pct": -9.27, "last_date": "2026-05-12"
  },
  "technical": {
    "last_close": 305.75, "rsi_14": 46.8,
    "macd": -0.56, "macd_signal": 1.21, "macd_hist": -1.77,
    "bb_upper": 333.2, "bb_middle": 314.5, "bb_lower": 295.8,
    "atr_14": 8.3, "sma_20": 312.4, "sma_50": 318.7, "ema_12": 311.2,
    "volume_avg_20": 52345000,
    "signal": {"trend": "bearish", "momentum": "neutral", "volatility": "normal"}
  },
  "financials": {                       # sayılar float'a cast edilmiş
    "period": "2026/3", "ticker": "THYAO",
    "Dönen Varlıklar": 485646000000.0,
    "Duran Varlıklar": 1384442925850.0,
    "Hasılat": 0.0
  },
  "ratios": {
    "period": "2026/3", "ticker": "THYAO",
    "cari_oran": 0.97, "borc_ozkaynak": 1.23, "aktif_toplam": 1870088925850.0
  },
  "disclosures": [
    {"date": "2026-04-29", "title": "..."}  # ISO date — normalize
  ],
  "analyst": {
    "recommendation": "AL", "target_price": 455.0, "upside_potential": 48.81
  },
  "company_news": [
    {"title": "...", "source": "Paratic", "date": "2026-05-12T15:56:00",
     "url": "...", "snippet": "...", "summary": "...", "real_url": "..."}
  ],
  "market_news": [...],
  "brent_oil_usd": 107.36,              # Energy squad
  "errors": {"financials": "...", ...},  # missing data tracking
  "_timings": {"macro": 1.42, "company": 0.83, "price": 2.10,
               "financials": 3.21, "disclosures": 1.55, "analyst": 0.94,
               "news": 18.7, "total": 28.75}
}
```

### 3.2 Ajan → Bundle Subset Routing

| Ajan | Subset | İş |
|---|---|---|
| Macro Context | `macro`, `market_news` | 1 paragraf, her cümle `[kaynak: <call_id>]` |
| Sector Router | `company.stockCode` | Squad döner |
| Technical Worker | `price`, `technical`, `company` | `TechnicalAnalysis` schema |
| Fundamental Worker | `financials`, `ratios`, `disclosures`, `analyst`, `company_news`, `company`, `brent_oil_usd` | Squad prompt'una göre `FundamentalAnalysis` schema |
| Devil's Advocate | Worker çıktıları + `memory_hits.base_rate` | `Critique` schema |
| Synthesizer | Bundle TÜMÜ + Worker output + Critique + memory_hits + `user_mode` | Streaming Markdown |
| Memory | Tez metni (yazma); ticker + query embedding (okuma) | top_k=3 |

**Bundle.errors handling:** `errors` dict'i boş değilse Synthesizer prompt'una **`MISSING_FIELDS: [fin, analyst]`** notu ile inject; Synthesizer "veri alınamadı" formatında yazar (§9 confidence ceza terimi).

---

## 4. Strands Tool Wrapper Pattern (Citation Provenance)

Citation enforcement'ın temeli: her tool çağrısı `tool_call_logs` tablosuna UUID `call_id` ile yazılır. Synthesizer `[kaynak: <call_id>]` etiketleriyle bu ID'lere bağlanır.

### 4.1 `@tool` + `@logged_tool` Decorator Stack

`strands` paketinin `@tool` decorator'ı docstring + type hints'ten metadata çıkarır. Logging ve cache wrapper'lar **`@tool`'un altında** stack'lenir:

```
@tool                    ← Strands görür (en üst)
@cache_redis             ← Hit varsa fn'i bypass et
@logged_tool             ← tool_call_logs'a UUID yaz
async def my_tool(...):
    ...
```

### 4.2 `logged_tool` Implementasyonu

```python
# backend/tools/_logged.py
import asyncio
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import wraps

from backend.db.models import ToolCallLog
from backend.db.session import async_session

# Orchestrator her ajan run'ından önce set eder
current_agent_ctx: ContextVar[str] = ContextVar("agent_id", default="unknown")
current_thesis_ctx: ContextVar[str | None] = ContextVar("thesis_id", default=None)
current_cache_hit_ctx: ContextVar[bool] = ContextVar("cache_hit", default=False)

def logged_tool(name: str):
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            call_id = uuid.uuid4()
            agent_id = current_agent_ctx.get()
            thesis_id = current_thesis_ctx.get()
            t0 = datetime.now(timezone.utc)
            status, err, payload = "ok", None, None
            try:
                if asyncio.iscoroutinefunction(fn):
                    payload = await fn(*args, **kwargs)
                else:
                    payload = await asyncio.to_thread(fn, *args, **kwargs)
            except Exception as e:
                status, err = "error", str(e)[:500]
            finally:
                async with async_session() as s:
                    s.add(ToolCallLog(
                        call_id=call_id,
                        thesis_id=thesis_id,
                        agent_id=agent_id,
                        tool_name=name,
                        args=_jsonable(kwargs),
                        result=payload if status == "ok" else {"error": err},
                        status=status,
                        cache_hit=current_cache_hit_ctx.get(),
                        ts=t0,
                        latency_ms=int((datetime.now(timezone.utc) - t0).total_seconds() * 1000),
                    ))
                    await s.commit()
                current_cache_hit_ctx.set(False)
            if status == "error":
                raise RuntimeError(f"{name} failed: {err}")
            # KRİTİK: agent {call_id, data} dict'i görür
            return {"call_id": str(call_id), "data": payload}
        return wrapper
    return decorator

def _jsonable(obj):
    """args dict'ini JSONB'ye uygun hale getir (UUID, datetime str)."""
    import json
    return json.loads(json.dumps(obj, default=str))
```

### 4.3 Tool Çıktısının Agent Tarafından Görülmesi

Strands tool dönüş değerini `ToolResult.content[0].text` formatında agent'a verir (otomatik string serialize). LLM `{"call_id": "abc-123", "data": {...}}` JSON görür ve `Citation.call_id` field'ına yapıştırabilir.

**Hata yönetimi:** Tool exception fırlatırsa Strands `EventLoopException` ile sarmalar. Tool retry için Hook kullanılır:

```python
from strands.hooks import Hook, AfterToolCallEvent

class ToolRetryHook(Hook):
    def __init__(self, max_retries: int = 1):
        self.attempts: dict[str, int] = {}
    def after_tool_call(self, event: AfterToolCallEvent):
        if event.error and self.attempts.get(event.tool_use_id, 0) < 1:
            self.attempts[event.tool_use_id] = self.attempts.get(event.tool_use_id, 0) + 1
            event.retry = True
```

### 4.4 Cache Sarmalayıcı (Redis)

```python
# backend/tools/_cache.py
import json
from functools import wraps
import redis.asyncio as redis
from backend.config.settings import settings
from backend.tools._logged import current_cache_hit_ctx

_r = redis.from_url(settings.REDIS_URL, decode_responses=True)

def cache_redis(key_template: str, ttl_seconds: int):
    """key_template: 'price:{ticker}:ohlcv:{days}d' — kwargs'tan format."""
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            key = key_template.format(**kwargs)
            cached = await _r.get(key)
            if cached:
                current_cache_hit_ctx.set(True)
                return json.loads(cached)
            result = await fn(*args, **kwargs)
            await _r.set(key, json.dumps(result, default=str), ex=ttl_seconds)
            return result
        return wrapper
    return decorator
```

**Decorator sırası (önemli):**

```python
@tool
@logged_tool(name="get_ohlcv")
@cache_redis("price:{ticker}:ohlcv:{days}d", ttl_seconds=900)
async def ohlcv_tool(ticker: str, days: int = 90) -> dict:
    ...
```

Akış: Strands tool çağrısı → cache miss → fn çalışır → cache yaz → log yaz → agent'a `{call_id, data}` dönüş. Cache hit'te `current_cache_hit_ctx=True` → log'a `cache_hit=True` flag.

### 4.5 Tool Tam Listesi — `backend/tools/data_tools.py`

```python
import asyncio
from strands import tool
from scripts.product import (
    macro, prices, financials, disclosures, analyst, news, technicals, companies
)
from backend.tools._logged import logged_tool
from backend.tools._cache import cache_redis

@tool
@logged_tool(name="get_macro_context")
@cache_redis("macro:context", ttl_seconds=900)
async def macro_context_tool() -> dict:
    """Türkiye makro göstergeleri (TCMB EVDS): USD/TRY, EUR/TRY, TÜFE YoY, faiz."""
    raw = await asyncio.to_thread(macro.get_macro_context)
    # TÜFE YoY hesaplaması §10.3
    raw["tufe_yoy_pct"] = await asyncio.to_thread(_compute_tufe_yoy)
    return raw

@tool
@logged_tool(name="get_market_news")
@cache_redis("news:market", ttl_seconds=3600)
async def market_news_tool(count: int = 8) -> list[dict]:
    """Genel piyasa haberleri (Google News + Mynet)."""
    return await asyncio.to_thread(news.get_market_news, count=count)

@tool
@logged_tool(name="get_company")
@cache_redis("company:{ticker}", ttl_seconds=86400)
async def company_tool(ticker: str) -> dict | None:
    """BIST şirket referans bilgisi (MKK API)."""
    return await asyncio.to_thread(companies.get_company_by_ticker, ticker.upper())

@tool
@logged_tool(name="get_ohlcv")
@cache_redis("price:{ticker}:ohlcv:{days}d", ttl_seconds=900)
async def ohlcv_tool(ticker: str, days: int = 90) -> dict:
    """Hisse OHLCV — yfinance primary, isyatirim secondary."""
    df = await asyncio.to_thread(prices.get_ohlcv, ticker, days=days)
    return {
        "source": df.attrs.get("source"),
        "rows": len(df),
        "last_close": float(df.iloc[-1]["Close"]),
        "first_close": float(df.iloc[0]["Close"]),
        "change_pct": round((float(df.iloc[-1]["Close"]) - float(df.iloc[0]["Close"]))
                            / float(df.iloc[0]["Close"]) * 100, 2),
        "last_date": str(df.index[-1].date()),
    }

@tool
@logged_tool(name="compute_indicators")
@cache_redis("tech:{ticker}:{days}d", ttl_seconds=900)
async def indicators_tool(ticker: str, days: int = 90) -> dict:
    """pandas-ta indikatörleri (RSI, MACD, Bollinger, ATR) + sinyal."""
    df = await asyncio.to_thread(prices.get_ohlcv, ticker, days=days)
    ind = await asyncio.to_thread(technicals.compute_indicators, df)
    return {**ind, "signal": technicals.technical_signal(ind)}

@tool
@logged_tool(name="get_index")
@cache_redis("price:{code}:ohlcv:{days}d", ttl_seconds=900)
async def index_tool(code: str = "XU100", days: int = 90) -> dict:
    """BIST endeksi (XU100, XBANK, vb.)."""
    df = await asyncio.to_thread(prices.get_index, code, days=days)
    return {
        "source": df.attrs.get("source"),
        "last_close": float(df.iloc[-1]["Close"]),
        "change_pct": round((float(df.iloc[-1]["Close"]) - float(df.iloc[0]["Close"]))
                            / float(df.iloc[0]["Close"]) * 100, 2),
    }

@tool
@logged_tool(name="get_financials")
@cache_redis("fin:{ticker}:latest", ttl_seconds=86400)
async def financials_tool(ticker: str) -> dict:
    """isyatirim çeyreklik finansal tablo (son çeyrek, float cast'lı)."""
    raw = await asyncio.to_thread(financials.get_latest_quarter, ticker)
    return {k: (_to_float(v) if k not in ("period", "ticker") else v) for k, v in raw.items()}

@tool
@logged_tool(name="compute_ratios")
@cache_redis("ratios:{ticker}:latest", ttl_seconds=86400)
async def ratios_tool(ticker: str) -> dict:
    """Temel oranlar (cari oran, borç/özkaynak, aktif)."""
    return await asyncio.to_thread(financials.compute_basic_ratios, ticker)

@tool
@logged_tool(name="get_disclosures")
@cache_redis("kap:{ticker}:filings:{days}d", ttl_seconds=3600)
async def disclosures_tool(ticker: str, days: int = 30) -> list[dict]:
    """KAP bildirimleri (MKK primary, pykap fallback)."""
    raw = await asyncio.to_thread(disclosures.get_company_disclosures, ticker, days=days)
    out = []
    for d in raw[:15]:
        out.append({
            "date": _norm_date(d.get("publishDate") or d.get("date") or d.get("publishedAt")),
            "title": (d.get("title") or "")[:200],
        })
    return out

@tool
@logged_tool(name="get_recommendation")
@cache_redis("analyst:{ticker}", ttl_seconds=86400)
async def recommendation_tool(ticker: str) -> dict:
    """borsapy analist tavsiyesi (AL/TUT/SAT + hedef + upside%)."""
    rec = await asyncio.to_thread(analyst.get_recommendation, ticker)
    return rec or {"recommendation": None, "target_price": None, "upside_potential": None}

@tool
@logged_tool(name="get_company_news")
@cache_redis("news:company:{ticker}", ttl_seconds=3600)
async def company_news_tool(ticker: str, count: int = 8) -> list[dict]:
    """Şirket-spesifik haberler (Google News, özetli)."""
    return await asyncio.to_thread(news.get_company_news, ticker,
                                    count=count, with_summary=True)

@tool
@logged_tool(name="get_dividends")
@cache_redis("dividend:{ticker}", ttl_seconds=86400)
async def dividends_tool(ticker: str) -> list[dict]:
    """Temettü geçmişi (yfinance)."""
    s = await asyncio.to_thread(prices.get_dividends, ticker)
    return [{"date": str(d.date()), "amount": float(v)} for d, v in s.items()]

@tool
@logged_tool(name="get_brent_oil")
@cache_redis("price:brent", ttl_seconds=3600)
async def brent_tool(days: int = 30) -> dict:
    """Brent petrolü (Energy squad korelasyonu için)."""
    df = await asyncio.to_thread(prices.get_brent_oil, days=days)
    return {
        "last_close": float(df.iloc[-1]["Close"]),
        "first_close": float(df.iloc[0]["Close"]),
        "change_pct": round((float(df.iloc[-1]["Close"]) - float(df.iloc[0]["Close"]))
                            / float(df.iloc[0]["Close"]) * 100, 2),
    }

@tool
@logged_tool(name="search_sector_keyword")
@cache_redis("peers:{keyword}", ttl_seconds=86400)
async def search_sector_tool(keyword: str) -> list[str]:
    """Sektör anahtar kelimesiyle peer arama (borsapy)."""
    return await asyncio.to_thread(analyst.search_sector, keyword)

# --- Helper'lar ---
def _to_float(v):
    try: return float(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError): return None

def _norm_date(v):
    """'12-05-2026' | 'Tue, 12 May 2026 15:56:00 GMT' | '2026-04-29T...' → '2026-04-29'."""
    from dateutil import parser
    try:
        return parser.parse(v, dayfirst=("-" in str(v) and len(str(v).split("-")[0]) == 2)).date().isoformat()
    except Exception:
        return v

def _compute_tufe_yoy() -> float | None:
    """Son 13 ayın TÜFE serisini al, YoY % hesapla."""
    from datetime import date, timedelta
    end = date.today().strftime("%d-%m-%Y")
    start = (date.today() - timedelta(days=400)).strftime("%d-%m-%Y")
    s = macro.get_series(macro.SERIES_TUFE, start, end)
    vals = [float(v) for it in s for k, v in it.items()
            if k.startswith("TP_AB") and v not in (None, "", "null")]
    if len(vals) >= 13:
        return round((vals[-1] / vals[-13] - 1) * 100, 2)
    return None
```

---

## 5. Pydantic Structured Output Schemas

Strands 1.0+: `structured_output_model` **call-time** parametresi. `result.structured_output` ile erişilir.

### 5.1 Schema Dosyaları (`backend/schemas/`)

```python
# backend/schemas/citations.py
from pydantic import BaseModel, Field
from typing import Literal

class Citation(BaseModel):
    text: str = Field(description="Atıf yapılan cümle/iddia")
    call_id: str = Field(description="tool_call_logs.call_id UUID — string formatında")
    confidence: int = Field(ge=0, le=100, default=90)

class Observation(BaseModel):
    text: str
    tool_call_id: str
```

```python
# backend/schemas/macro.py
from pydantic import BaseModel
from backend.schemas.citations import Citation

class MacroContext(BaseModel):
    paragraph: str   # her cümle [kaynak: <call_id>] ile bitmeli
    indicators: dict  # {"usd_try": float, "tufe_yoy_pct": float, ...}
    citations: list[Citation]
```

```python
# backend/schemas/technical.py
from pydantic import BaseModel, Field
from typing import Literal
from backend.schemas.citations import Citation, Observation

class TechnicalAnalysis(BaseModel):
    trend_short: Literal["bullish", "bearish", "neutral"]
    trend_long: Literal["bullish", "bearish", "neutral"]
    key_levels: dict  # {"support": [list[float]], "resistance": [list[float]]}
    momentum_score: int = Field(ge=0, le=100)
    patterns_detected: list[str] = []
    notable_observations: list[Observation]
    citations: list[Citation]
```

```python
# backend/schemas/fundamental.py
from pydantic import BaseModel
from typing import Literal
from backend.schemas.citations import Citation, Observation

Squad = Literal["Banking", "Energy", "Defense", "Retail", "RealEstate", "Generic"]

class FundamentalAnalysis(BaseModel):
    squad: Squad
    squad_metrics: dict     # squad-specific (NIM/NPL, refining margin, backlog, vb.)
    ratios: dict
    recent_filings: list[Observation]
    analyst_consensus: dict  # {"recommendation": "AL", "target_price": float, "upside_pct": float}
    peer_position: str | None
    notable_observations: list[Observation]
    citations: list[Citation]
```

```python
# backend/schemas/critique.py
from pydantic import BaseModel, Field

class Critique(BaseModel):
    technical_pushback: list[str]
    fundamental_pushback: list[str]
    cross_cutting_risks: list[str]
    base_rate_warnings: list[str]
    overall_critique_strength: int = Field(ge=0, le=100)
```

```python
# backend/schemas/synthesis.py
from pydantic import BaseModel, Field
from typing import Literal
from backend.schemas.citations import Citation

class ConfidenceBreakdown(BaseModel):
    data_quality: int = Field(ge=0, le=100)
    technical_score: int = Field(ge=0, le=100)
    fundamental_score: int = Field(ge=0, le=100)
    news_macro_alignment: int = Field(ge=0, le=100)
    memory_base_rate: int = Field(ge=0, le=100)
    devils_advocate_inverse: int = Field(ge=0, le=100)
    total: int = Field(ge=0, le=100)

class Thesis(BaseModel):
    ticker: str
    squad: str
    user_mode: Literal["default", "conservative"]
    markdown: str                  # tam streaming text
    tldr: str                      # 1-2 cümle özet (UI card için)
    bull_points: list[str]
    bear_points: list[str]
    catalysts: list[str]
    confidence: ConfidenceBreakdown
    citations: list[Citation]
    soft_flags: list[str] = []
```

```python
# backend/schemas/sector.py
from pydantic import BaseModel
from typing import Literal

class SectorAssignment(BaseModel):
    ticker: str
    squad: Literal["Banking", "Energy", "Defense", "Retail", "RealEstate", "Generic"]
    source: Literal["static_map", "llm_fallback"]
    confidence: int  # 95 (static) veya 70 (llm)
```

### 5.2 Squad System Prompts (Fundamental Worker)

`backend/agents/_squad_prompts.py`:

```python
SQUAD_PROMPTS = {
    "Banking": """Banking squad'ısın. Anahtar metrikler:
- NIM (Net Interest Margin) = Net Faiz Geliri / Ortalama Faiz Getiren Aktifler
- NPL ratio = Takipteki Krediler / Toplam Krediler
- CAR (Sermaye Yeterlilik Rasyosu) ≥ 12%
- CASA = (Vadesiz Mevduat) / Toplam Mevduat
- Kredi/Mevduat oranı
isyatirim financials'dan "Net Faiz Geliri", "Krediler", "Mevduatlar" kalemlerini ara. 
KAP bildirimlerinden 'sermaye yeterlilik', 'takipteki' kelimelerini tara.""",

    "Energy": """Energy squad'ısın. Anahtar metrikler:
- Refining margin (rafineri marjı) = Brent/petrol türevi kâr farkı
- Brent fiyatı ile son 30 günlük korelasyon (Pearson r)
- Kapasite kullanım oranı
- EPDK düzenleme etkisi
get_brent_oil çağır + ohlcv ile Pearson r hesabı yap.""",

    "Defense": """Defense squad'ısın. Anahtar metrikler:
- Backlog (sözleşmeli iş yükü) — KAP sözleşme bildirimi
- R&D harcaması / Hasılat % — IFRS satırı 'Araştırma Geliştirme Giderleri'
- USD revenue % — döviz cinsi anlaşmalar
- Yeni sözleşmeler (TSK, dış müşteri)
Disclosures'da 'sözleşme', 'ihale', 'kontrat' kelimelerini ara.""",

    "Retail": """Retail squad'ısın. Anahtar metrikler:
- LFL (Like-for-Like) büyüme — aynı mağaza satış değişimi
- Mağaza sayısı + açılış/kapanış
- Sepet büyüklüğü (ortalama gelir / işlem)
- SSS (Same Store Sales) trendi
KAP'ta 'faaliyet raporu' ve 'mağaza' kelimelerini ara.""",

    "RealEstate": """RealEstate squad'ısın. Anahtar metrikler:
- NAV iskonto = (NAV - market cap) / NAV %
- Portföy doluluk oranı
- Ekspertiz raporu portföy değeri (KAP)
- Kira artışları""",

    "Generic": """Generic squad'ısın. Temel oranlara odaklan: P/E, P/B, ROE, EBITDA marjı.
compute_ratios çıktısını yorumla."""
}
```

---

## 6. Orkestrasyon — Strands Graph + Parallel Pattern

Süre bütçesi (§19.2 detay): bundle prefetch async ~12s + 3-bacak ~1.5s + 2-worker ~17.5s + Devil ~7.5s + Synth ~20s + citation+persist ~4s = **~50-55s realistic**, pre-warm cache **<8s**.

### 6.1 Model Provider Tanımları

`backend/agents/_models.py`:

```python
from strands.models import GeminiModel
from backend.config.settings import settings

def flash_model() -> GeminiModel:
    return GeminiModel(
        client_args={"api_key": settings.GOOGLE_API_KEY},
        model_id="gemini-2.5-flash",
        params={"temperature": 0.4, "max_output_tokens": 4096, "top_p": 0.9},
    )

def pro_model() -> GeminiModel:
    return GeminiModel(
        client_args={"api_key": settings.GOOGLE_API_KEY},
        model_id="gemini-2.5-pro",
        params={"temperature": 0.3, "max_output_tokens": 8192, "top_p": 0.9},
    )
```

### 6.2 Strands Agent Tanımları

```python
# backend/agents/macro_context.py
from strands import Agent
from strands.conversation_manager import NullConversationManager
from backend.agents._models import flash_model
from backend.tools.data_tools import macro_context_tool, market_news_tool

macro_context_agent = Agent(
    name="macro_context",
    model=flash_model(),
    system_prompt="""Sen Türkiye makro ekonomi analistisin. TCMB verisinden ve piyasa
haberlerinden 1 kısa paragraf (3-5 cümle) makro durum özeti yaz. KESİN KURALLAR:
- Her cümle sonunda [kaynak: <call_id>] zorunlu (tool dönüş değerindeki call_id'yi yapıştır).
- Sayı uydurmak yasak — sadece tool çıktısında olan sayıları kullan.
- TÜFE'yi YoY % olarak yaz (tufe_yoy_pct field'ı), ham endeks değerini kullanma.
- USD/TRY ve faiz oranını çıkar.
Çıktı: MacroContext schema (paragraph + indicators + citations).""",
    tools=[macro_context_tool, market_news_tool],
    max_iterations=3,
    conversation_manager=NullConversationManager(),
)
```

```python
# backend/agents/technical_worker.py
from backend.agents._models import flash_model
from backend.tools.data_tools import ohlcv_tool, indicators_tool, index_tool

technical_worker = Agent(
    name="technical_worker",
    model=flash_model(),
    system_prompt="""Sen teknik analistsin. İndikatörlerden (RSI, MACD, Bollinger, ATR, SMA)
trend, momentum ve volatiliteyi yorumla. KESİN KURALLAR:
- Max 4 tool call (ohlcv, indicators, index, peer index).
- Her observation'a tool_call_id eklenmeli.
- Spekülasyon yasak; sadece sayılardan çıkan yorum.
- key_levels'a support/resistance listesi koy.
- Endeks (XU100) ile relative strength karşılaştırması yap.""",
    tools=[ohlcv_tool, indicators_tool, index_tool],
    max_iterations=5,
    conversation_manager=NullConversationManager(),
)
```

```python
# backend/agents/fundamental_worker.py
from backend.agents._models import flash_model
from backend.agents._squad_prompts import SQUAD_PROMPTS
from backend.tools.data_tools import (
    disclosures_tool, financials_tool, ratios_tool,
    recommendation_tool, dividends_tool, company_news_tool,
    search_sector_tool, brent_tool,
)

def make_fundamental_worker(squad: str) -> Agent:
    base_tools = [disclosures_tool, financials_tool, ratios_tool,
                  recommendation_tool, company_news_tool, search_sector_tool, dividends_tool]
    if squad == "Energy":
        base_tools.append(brent_tool)
    return Agent(
        name=f"fundamental_worker_{squad.lower()}",
        model=flash_model(),
        system_prompt=f"""Sen fundamental analistsin.

{SQUAD_PROMPTS[squad]}

ORTAK KURALLAR:
- Max 6 tool call.
- Her veriden çıkan iddia için Observation üret, tool_call_id ekle.
- squad_metrics alanını squad'a özel doldur.
- Sayı uydurmak yasak.""",
        tools=base_tools,
        max_iterations=7,
        conversation_manager=NullConversationManager(),
    )
```

```python
# backend/agents/devils_advocate.py
from backend.agents._models import pro_model
from backend.tools.memory_tools import memory_base_rate_tool

devils_advocate_agent = Agent(
    name="devils_advocate",
    model=pro_model(),                # Pro — kalite kritik
    system_prompt="""Sen kıdemli risk yöneticisisin. ThesisForge'un komite sürecindeki
Devil's Advocate rolündesin. Worker'ların raporunu **bilinçli olarak** sorgula.

FELSEFE: Hisseyi kötülemiyorsun. Tezi GÜÇLENDİRMEK için zayıflıkları açığa çıkarıyorsun.

YAPMAN GEREKEN:
- Technical worker'ın "trend bullish" iddiasını sorgula: base rate ne?
- Fundamental worker'ın "AL" iddiasının ters senaryosu ne olur?
- Cross-cutting risk: makro şokun bu hisseye etkisi?
- Memory'den base_rate çek: benzer geçmiş tezlerde ne oldu?

Çıktı: Critique schema. overall_critique_strength 0 (zayıf) - 100 (çok güçlü).""",
    tools=[memory_base_rate_tool],
    max_iterations=4,
    conversation_manager=NullConversationManager(),
)
```

```python
# backend/agents/synthesizer.py
from backend.agents._models import pro_model

# §6.3 SYNTHESIZER_PROMPT_TEMPLATE'in render edilmiş versiyonu
def make_synthesizer(user_mode: str) -> Agent:
    from backend.agents._synth_prompts import render_synthesizer_prompt
    return Agent(
        name="synthesizer",
        model=pro_model(),
        system_prompt=render_synthesizer_prompt(user_mode),
        tools=[],                    # veri çekmez
        max_iterations=1,            # tek pass, retry citation_validator dışarıdan
        conversation_manager=NullConversationManager(),
    )
```

### 6.3 Synthesizer Prompt Template

`backend/agents/_synth_prompts.py`:

```python
SYNTHESIZER_PROMPT_TEMPLATE = """
Sen ThesisForge'un baş analistisin. Tüm worker raporlarını ve Devil's Advocate
critique'ini sentezleyip Markdown formatında bir yatırım tezi yaz.

SIRA ({mode_label}):
{section_order}

KESİN KURALLAR:
1. Her sayısal claim sonunda [kaynak: <call_id>] zorunlu. <call_id> input'taki
   citations listesinden seçilir; uydurma yasak.
2. Bull/Bear DENGELİ olsun (default mode).
3. Tahmin yasak: "şu varsayımlar tutarsa..." formatı.
4. Sayı uydurmak yasak. Input bundle / worker output'larda olmayan sayı kullanma.
5. MISSING_FIELDS varsa: o alan için "veri alınamadı" notu yaz, uydurma.
6. Disclaimer zorunlu: "ThesisForge yatırım tavsiyesi değildir, bilgi amaçlıdır."

ÇIKTI: Thesis schema (markdown + tldr + bull_points + bear_points + catalysts +
confidence + citations + soft_flags).

{mode_specific_rules}
"""

DEFAULT_SECTIONS = """
1. TL;DR (1-2 cümle özet)
2. Bull Case (3-5 madde)
3. Bear Case (3-5 madde)
4. Anahtar Katalizörler 📅 (gelecek 30-90 gün)
5. Tarihsel Bağlam (Memory hits — varsa)
6. Risk Uyarıları
7. Güven Skoru (breakdown ile)
8. Disclaimer
"""

CONSERVATIVE_SECTIONS = """
1. TL;DR
2. Bear Case ← İLK SIRADA
3. Bull Case
4. Anahtar Katalizörler 📅
5. Tarihsel Bağlam (Memory)
6. Risk Uyarıları + Volatilite
7. Temettü Güvenliği (ZORUNLU başlık)
8. "Bu hisse muhafazakar profil için uygun mu?" (1 paragraf değerlendirme)
9. Güven Skoru (≤70 cap'li)
10. Disclaimer
"""

CONSERVATIVE_RULES = """
EK KURALLAR (CONSERVATIVE MODE):
- Bear case Bull case'den ÖNCE gelmeli.
- Confidence skoru 70'i geçemez (cap).
- Temettü güvenliği başlığı atlanamaz — get_dividends sonucundan yararlan.
- Volatilite uyarısı: ATR/Close > %4 ise "yüksek volatilite" notu ekle.
- Son cümle: "Bu hisse muhafazakar profil için [uygun / kısmen uygun / uygun değil] çünkü..."
"""

def render_synthesizer_prompt(user_mode: str) -> str:
    if user_mode == "conservative":
        return SYNTHESIZER_PROMPT_TEMPLATE.format(
            mode_label="conservative mode — bear-first, dividend-emphasis",
            section_order=CONSERVATIVE_SECTIONS,
            mode_specific_rules=CONSERVATIVE_RULES,
        )
    return SYNTHESIZER_PROMPT_TEMPLATE.format(
        mode_label="default mode — balanced",
        section_order=DEFAULT_SECTIONS,
        mode_specific_rules="",
    )
```

### 6.4 Streaming + Structured Output Kombinasyonu

**Önemli kısıt:** Strands şu an "structured output WHILE streaming" hibridini tam desteklemiyor. Çözüm: **ham markdown'ı stream et, sonunda parse + yapılandır.**

```python
# backend/agents/synthesizer.py — pipeline runner
from backend.schemas.synthesis import Thesis, ConfidenceBreakdown

async def run_synthesizer_streaming(agent: Agent, prompt: str, ws_send):
    """Streaming markdown WebSocket'e push; biten markdown'dan Thesis parse."""
    full_text = []
    async for event in agent.stream_async(prompt):
        if hasattr(event, "text") and event.text:
            full_text.append(event.text)
            await ws_send({"type": "token", "text": event.text})
        elif hasattr(event, "tool_use_id"):
            await ws_send({"type": "tool_call",
                           "tool_name": getattr(event, "tool_name", ""),
                           "call_id": event.tool_use_id})
    markdown = "".join(full_text)
    # Markdown'dan Thesis schema'sına post-parse:
    return _parse_thesis_markdown(markdown, prompt_meta)

def _parse_thesis_markdown(md: str, meta: dict) -> Thesis:
    """## başlıklarına göre bull/bear/catalysts/confidence çıkar.
    Confidence skorunu compute_confidence (§9) hesaplar; LLM'den bekleme."""
    ...
```

### 6.5 Sector Router — Static + LLM Fallback (Graph Pattern)

```python
# backend/agents/sector_router.py
import yaml
from pathlib import Path
from strands import Agent
from backend.agents._models import flash_model
from backend.schemas.sector import SectorAssignment

_MAP_PATH = Path("backend/config/sector_map.yaml")
SECTOR_MAP = yaml.safe_load(_MAP_PATH.read_text())
TICKER_TO_SQUAD = {t: squad for squad, tickers in SECTOR_MAP.items() for t in tickers}

async def assign_sector(ticker: str) -> SectorAssignment:
    """Önce static map; yoksa LLM fallback (low temperature)."""
    ticker = ticker.upper()
    if ticker in TICKER_TO_SQUAD:
        return SectorAssignment(
            ticker=ticker, squad=TICKER_TO_SQUAD[ticker],
            source="static_map", confidence=95
        )
    # LLM fallback
    llm = Agent(
        name="sector_router_llm",
        model=flash_model(),
        system_prompt="""BIST'te listeli bir hissenin sektörünü belirle.
Seçenekler: Banking, Energy, Defense, Retail, RealEstate, Generic.
Bilmiyorsan Generic seç. Sadece bir kelime cevap ver.""",
        tools=[],
        max_iterations=1,
    )
    result = await llm.invoke_async(f"Ticker: {ticker}. Sektör?")
    raw = str(result).strip().split()[0]
    squad = raw if raw in SECTOR_MAP else "Generic"
    return SectorAssignment(ticker=ticker, squad=squad,
                            source="llm_fallback", confidence=70)
```

### 6.6 Orchestrator Pipeline (Tam)

```python
# backend/agents/orchestrator.py
import asyncio
import uuid
from backend.tools._logged import current_agent_ctx, current_thesis_ctx
from backend.services.bundle_async import build_thesis_bundle_async
from backend.agents.macro_context import macro_context_agent
from backend.agents.technical_worker import technical_worker
from backend.agents.fundamental_worker import make_fundamental_worker
from backend.agents.devils_advocate import devils_advocate_agent
from backend.agents.synthesizer import make_synthesizer, run_synthesizer_streaming
from backend.agents.sector_router import assign_sector
from backend.agents.memory import memory_search, memory_write_async
from backend.agents.citation_validator import validate
from backend.services.confidence import compute_confidence
from backend.services.persistence import persist_thesis
from backend.schemas.synthesis import Thesis
from backend.schemas.macro import MacroContext
from backend.schemas.technical import TechnicalAnalysis
from backend.schemas.fundamental import FundamentalAnalysis
from backend.schemas.critique import Critique

PIPELINE_TIMEOUT_SEC = 90

async def run_thesis_pipeline(
    ticker: str, user_id: str | None = None,
    user_mode: str = "default", ws_send=None,
) -> Thesis:
    thesis_id = str(uuid.uuid4())
    current_thesis_ctx.set(thesis_id)

    async def _pipeline():
        # AŞAMA 0 — Bundle prefetch (async, 12-15s hedef)
        if ws_send: await ws_send({"type": "stage", "name": "bundle_start"})
        bundle = await build_thesis_bundle_async(ticker)
        if ws_send: await ws_send({"type": "stage", "name": "bundle_done",
                                    "data": {"errors": list(bundle.get("errors", {}).keys())}})

        # AŞAMA 1 — 3-bacak paralel
        current_agent_ctx.set("sector_router")
        sector_task = assign_sector(ticker)
        current_agent_ctx.set("macro_context")
        macro_task = macro_context_agent.invoke_async(
            f"Bundle.macro: {bundle['macro']}\nBundle.market_news: {bundle['market_news'][:3]}",
            structured_output_model=MacroContext,
        )
        current_agent_ctx.set("memory")
        memory_task = memory_search(ticker=ticker,
                                     query=f"{ticker} yatırım tezi", top_k=3)
        sector, macro_result, memory_hits = await asyncio.gather(
            sector_task, macro_task, memory_task
        )
        macro_ctx: MacroContext = macro_result.structured_output
        squad = sector.squad

        if ws_send: await ws_send({"type": "stage", "name": "stage1_done",
                                    "data": {"squad": squad, "memory_hits_n": len(memory_hits)}})

        # AŞAMA 2 — 2 Worker paralel
        current_agent_ctx.set("technical_worker")
        tech_task = technical_worker.invoke_async(
            f"""Ticker: {ticker}
Bundle.price: {bundle['price']}
Bundle.technical: {bundle['technical']}
Tools: get_ohlcv, compute_indicators, get_index. Max 4 tool call.""",
            structured_output_model=TechnicalAnalysis,
        )
        current_agent_ctx.set(f"fundamental_worker_{squad.lower()}")
        fund_agent = make_fundamental_worker(squad)
        fund_subset = {
            "financials": bundle.get("financials"),
            "ratios": bundle.get("ratios"),
            "disclosures": bundle.get("disclosures"),
            "analyst": bundle.get("analyst"),
            "company_news": bundle.get("company_news"),
            "company": bundle.get("company"),
            "brent_oil_usd": bundle.get("brent_oil_usd"),
        }
        fund_task = fund_agent.invoke_async(
            f"Ticker: {ticker}\nSquad: {squad}\nBundle subset: {fund_subset}",
            structured_output_model=FundamentalAnalysis,
        )
        tech_result, fund_result = await asyncio.gather(tech_task, fund_task)
        technical: TechnicalAnalysis = tech_result.structured_output
        fundamental: FundamentalAnalysis = fund_result.structured_output

        if ws_send: await ws_send({"type": "stage", "name": "workers_done"})

        # AŞAMA 3 — Devil's Advocate
        current_agent_ctx.set("devils_advocate")
        crit_result = await devils_advocate_agent.invoke_async(
            f"""Technical: {technical.model_dump()}
Fundamental: {fundamental.model_dump()}
Memory hits: {memory_hits}""",
            structured_output_model=Critique,
        )
        critique: Critique = crit_result.structured_output

        if ws_send: await ws_send({"type": "stage", "name": "devil_done"})

        # AŞAMA 4 — Synthesizer (streaming)
        current_agent_ctx.set("synthesizer")
        synth_agent = make_synthesizer(user_mode)
        synth_prompt = _build_synth_prompt(
            bundle=bundle, macro=macro_ctx, technical=technical,
            fundamental=fundamental, critique=critique,
            memory_hits=memory_hits, user_mode=user_mode,
        )
        if ws_send: await ws_send({"type": "stage", "name": "synth_start"})
        thesis = await run_synthesizer_streaming(synth_agent, synth_prompt, ws_send)
        thesis.ticker = ticker
        thesis.squad = squad
        thesis.user_mode = user_mode

        # AŞAMA 5 — Citation validate + persist
        current_agent_ctx.set("citation_validator")
        validated = await validate(thesis, synth_agent, synth_prompt)
        validated.confidence = compute_confidence(
            thesis_id=thesis_id, bundle=bundle,
            technical=technical, fundamental=fundamental,
            macro_ctx=macro_ctx, memory_hits=memory_hits,
            critique=critique, user_mode=user_mode,
        )
        await persist_thesis(validated, user_id=user_id, thesis_id=thesis_id)
        asyncio.create_task(memory_write_async(validated))

        if ws_send: await ws_send({"type": "thesis_complete",
                                    "thesis_id": thesis_id,
                                    "confidence": validated.confidence.total})
        return validated

    # Kill-switch (§12): timeout sınırı
    try:
        return await asyncio.wait_for(_pipeline(), timeout=PIPELINE_TIMEOUT_SEC)
    except asyncio.TimeoutError:
        from backend.services.killswitch import serve_fixture_thesis
        return await serve_fixture_thesis(ticker, user_mode, ws_send,
                                           reason="timeout")
```

### 6.7 Conservative Mode Trigger

User `user_mode` üç yerden gelebilir, sırayla kontrol:

1. **WebSocket connect mesajında:** `{"ticker": "TUPRS", "user_mode": "conservative"}`
2. **Query param:** `/ws/thesis/<sid>?mode=conservative`
3. **User profili:** `users.user_mode` DB'den oku (auth varsa)

Tüm yollar `user_mode` parametresine düşer → `make_synthesizer(user_mode)` factory bunu prompt'a render eder.

**UI yerleştirme** (Frontend ekibi kararı): Header sağ üstte "🛡️ Muhafazakar Mod" toggle. Ali Bey persona için default `true`. `users.user_mode_default` field'ı (§8.3) ile persist.

---

## 7. Citation Validator

`docs/flows.md §3` enforcement. **1-retry + selective soft flag.**

### 7.1 Tam Implementasyon

```python
# backend/agents/citation_validator.py
import re
from uuid import UUID
from sqlalchemy import select
from backend.db.session import async_session
from backend.db.models import ToolCallLog
from backend.schemas.synthesis import Thesis

CITATION_RE = re.compile(r"\[kaynak:\s*([0-9a-f-]{36})\]", re.I)
# Türkçe sayı formatı: 1.234,56 veya 1234.56 veya %39,2 veya 485,6 milyar ₺
NUMBER_RE = re.compile(
    r"-?\d+(?:[.,]\d+)*\s*(?:milyon|milyar|trilyon|%|₺|TL|\$)?",
    re.I
)

async def validate(thesis: Thesis, synth_agent, original_prompt: str,
                   max_retries: int = 1) -> Thesis:
    for attempt in range(max_retries + 1):
        # 1. Citation ID'leri DB'de var mı?
        cited_ids = set(CITATION_RE.findall(thesis.markdown))
        valid_ids = await _existing_call_ids(cited_ids)
        invalid_ids = cited_ids - valid_ids

        # 2. Sayıları yakala, tool log result'larında var mı kontrol et
        sentences = _split_sentences(thesis.markdown)
        failed_sentences = []
        for sent in sentences:
            sent_ids = set(CITATION_RE.findall(sent))
            sent_nums = NUMBER_RE.findall(sent)
            if not sent_nums:
                continue  # sayısız cümleye dokunma
            if not sent_ids:
                failed_sentences.append((sent, "missing_citation"))
                continue
            # bu cümledeki sayılar, atıf yapılan tool_call result'larında var mı?
            ok = await _numbers_in_tool_results(sent_nums, sent_ids & valid_ids)
            if not ok:
                failed_sentences.append((sent, "number_mismatch"))

        if not invalid_ids and not failed_sentences:
            return thesis  # ✅ pass

        if attempt < max_retries:
            feedback = _build_feedback(invalid_ids, failed_sentences)
            retry_result = await synth_agent.invoke_async(
                original_prompt + "\n\n--- CITATION DÜZELT ---\n" + feedback,
            )
            # Re-parse markdown'dan yeni thesis
            thesis = _reparse(retry_result, thesis)
            continue

        # 2. tur da fail → SELECTIVE soft flag (yalnız failed sentence'ler)
        thesis.markdown = _annotate_failed_sentences(
            thesis.markdown, failed_sentences, invalid_ids
        )
        thesis.soft_flags.append("[KAYNAKSIZ]")
        return thesis

async def _existing_call_ids(ids: set[str]) -> set[str]:
    if not ids:
        return set()
    async with async_session() as s:
        stmt = select(ToolCallLog.call_id).where(
            ToolCallLog.call_id.in_([UUID(i) for i in ids])
        )
        rows = (await s.execute(stmt)).scalars().all()
        return {str(r) for r in rows}

async def _numbers_in_tool_results(numbers: list[str], call_ids: set[str]) -> bool:
    """Bir cümledeki sayılardan EN AZ BİRİ, atıf yapılan tool result'larda
    geçiyor mu? Tam string match değil, sayısal tolerance (±2% veya 0.01)."""
    if not call_ids:
        return False
    async with async_session() as s:
        rows = (await s.execute(
            select(ToolCallLog.result).where(
                ToolCallLog.call_id.in_([UUID(i) for i in call_ids])
            )
        )).scalars().all()
    haystack = " ".join(str(r) for r in rows)
    for num_str in numbers:
        if _number_matches_in_text(num_str, haystack):
            return True
    return False

def _number_matches_in_text(num_str: str, text: str) -> bool:
    """1.234,56 ↔ 1234.56 normalize; 485 milyar ↔ 485000000000."""
    import re as _re
    clean = _re.sub(r"[^\d.,-]", "", num_str).replace(".", "").replace(",", ".")
    try:
        n = float(clean)
    except ValueError:
        return False
    # Magnitude (milyar/milyon)
    if "milyar" in num_str.lower(): n *= 1e9
    elif "milyon" in num_str.lower(): n *= 1e6
    elif "trilyon" in num_str.lower(): n *= 1e12
    # Tolerance: ±2% veya 0.01
    tol = max(abs(n) * 0.02, 0.01)
    # haystack'te 8 digit prefix match yeterli (yaklaşık)
    expected_strs = [f"{n:.0f}", f"{n:.2f}", f"{n:.4f}",
                     f"{n:.6e}", str(n).replace(".0", "")]
    return any(e[:6] in text for e in expected_strs if len(e) >= 4)

def _split_sentences(md: str) -> list[str]:
    """Markdown'ı cümlelere ayır (header'ları ve liste item'larını koru)."""
    import re as _re
    return [s.strip() for s in _re.split(r"(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])", md) if s.strip()]

def _build_feedback(invalid_ids: set[str], failed_sentences: list[tuple]) -> str:
    out = []
    if invalid_ids:
        out.append("Şu citation ID'leri tool_call_logs'ta YOK — sil veya değiştir:")
        for i in invalid_ids:
            out.append(f"  - {i}")
    if failed_sentences:
        out.append("\nŞu cümlelerde sayı/atıf eşleşmedi — düzelt veya kaldır:")
        for sent, reason in failed_sentences[:5]:
            out.append(f"  [{reason}] {sent[:160]}")
    out.append("\nDüzeltilmiş Thesis schema'sını döndür.")
    return "\n".join(out)

def _annotate_failed_sentences(md: str, failed: list[tuple], invalid_ids: set[str]) -> str:
    """SADECE failed sentence'lere [KAYNAKSIZ] yapıştır; gerisine dokunma."""
    out = md
    for sent, _reason in failed:
        if sent in out:
            out = out.replace(sent, sent.rstrip(".!?") + " [KAYNAKSIZ].", 1)
    for bad_id in invalid_ids:
        out = out.replace(f"[kaynak: {bad_id}]", "[KAYNAKSIZ]")
    return out
```

### 7.2 UI Davranışı

`[KAYNAKSIZ]` etiketi turuncu rozetle gösterilir (frontend `<Badge variant="warning">`). `theses.had_kaynaksiz_flag = True` → istatistik için (sistem güveni metriği §17).

---

## 7.5 DataProvider Registry Pattern

`docs/data.md §5`'in implementasyonu. Şu an product/* fonksiyonları primary'i çağırıyor; chain abstraction agent branch'inde yapılır.

### 7.5.1 Interface

```python
# backend/services/providers/base.py
from abc import ABC, abstractmethod
from typing import Any
import asyncio

class DataUnavailable(Exception): pass
class ProviderTimeout(Exception): pass

class DataProvider(ABC):
    name: str
    timeout_seconds: int = 10

    @abstractmethod
    async def fetch(self, key: str, **kwargs) -> Any: ...

class ChainedProvider:
    """primary → secondary → fixture sırası."""
    def __init__(self, primary: DataProvider,
                 secondary: DataProvider | None = None,
                 fixture: DataProvider | None = None):
        self.chain = [p for p in (primary, secondary, fixture) if p]

    async def fetch(self, key: str, **kwargs) -> dict:
        last_err = None
        for p in self.chain:
            try:
                payload = await asyncio.wait_for(
                    p.fetch(key, **kwargs), timeout=p.timeout_seconds
                )
                return {"provider": p.name, "payload": payload}
            except (ProviderTimeout, Exception) as e:
                last_err = (p.name, str(e))
                continue
        raise DataUnavailable(f"All providers failed: {last_err}")
```

### 7.5.2 Provider Implementasyonları

```python
# backend/services/providers/yfinance_provider.py
from .base import DataProvider
from scripts.product import prices
import asyncio

class YfinanceProvider(DataProvider):
    name = "yfinance"
    timeout_seconds = 10
    async def fetch(self, key: str, ticker: str, days: int = 90, **_) -> dict:
        df = await asyncio.to_thread(prices.get_ohlcv, ticker, days=days)
        if df.attrs.get("source") != "yfinance":
            raise Exception("yfinance fell through to isyatirim")
        return df.to_dict(orient="records")

# benzer: IsyatirimProvider, FixtureProvider, MkkProvider, KapRssProvider...
```

### 7.5.3 Registry

```python
# backend/services/providers/registry.py
from .yfinance_provider import YfinanceProvider
from .isyatirim_provider import IsyatirimProvider
from .fixture_provider import FixtureProvider
from .base import ChainedProvider

REGISTRY = {
    "price.ohlcv": ChainedProvider(
        primary=YfinanceProvider(),
        secondary=IsyatirimProvider(),
        fixture=FixtureProvider(domain="price"),
    ),
    "kap.filings": ChainedProvider(
        primary=MkkProvider(), secondary=KapRssProvider(),
        fixture=FixtureProvider(domain="kap"),
    ),
    # ... data.md §3'teki her satır için
}

async def fetch(domain_key: str, **kwargs):
    return await REGISTRY[domain_key].fetch(domain_key, **kwargs)
```

**Test mode flag:** `THESISFORGE_MODE=fixture` → `FixtureProvider` her zaman primary'ye geçer (LLM'siz pipeline testi için).

---

## 8. Eksik Alt-Sistemler

### 8.1 `sector_map.yaml` — Tam BIST Mapping

`backend/config/sector_map.yaml`:

```yaml
# BIST 50 + extras — docs/agents.md §3 tablosundan + risks.md Karar #11
# Listede olmayan ticker → Generic + LLM fallback (confidence=70)

Banking:
  - GARAN
  - AKBNK
  - ISCTR
  - YKBNK
  - HALKB
  - VAKBN
  - TSKB
  - ALBRK

Energy:
  - TUPRS
  - AKSEN
  - AKSA
  - ZOREN
  - ENJSA
  - AYGAZ
  - PETKM
  - TKFEN

Defense:
  - ASELS
  - OTKAR
  - KCHOL    # holding ama defense ağırlığı yüksek
  - SAVK
  - KATMR

Retail:
  - BIMAS
  - MGROS
  - SOKM
  - ULKER
  - CCOLA
  - ARCLK
  - VESTL
  - TUKAS

RealEstate:
  - EKGYO
  - ISGYO
  - SAHOL    # holding ama gayrimenkul portföyü
  - AGHOL
  - DOHOL
  - TRGYO

# Generic (BIST 50 dışı ya da sınıflandırılamayan) — listede tutma, LLM fallback yapacak
# Örnek: THYAO (havayolu), EREGL (demir-çelik), KOZAL (madencilik) — Generic'e düşer
```

LLM fallback için `assign_sector` (§6.5).

### 8.2 Memory Agent (OpenAI + pgvector)

```python
# backend/agents/memory.py
import hashlib
from datetime import date, timedelta
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from backend.config.settings import settings
from backend.db.session import async_session
from backend.db.models import Thesis as ThesisRow
from backend.schemas.synthesis import Thesis
import redis.asyncio as redis
import json

_oai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 768   # 3072 → 768 dimension reduction (database.md §1.2 ile uyumlu)

# Cosine distance cutoff'ları:
#  < 0.5  → çok yakın, mutlaka inject
#  0.5-0.8 → uzak ama yararlı, inject ama düşük ağırlık
#  > 0.8  → alakasız, drop
DISTANCE_CUTOFF = 0.8

async def embed(text: str) -> list[float]:
    """Embedding cache: SHA-256 hash key, 7 gün TTL."""
    key = f"embed:{hashlib.sha256(text.encode()).hexdigest()}"
    cached = await _redis.get(key)
    if cached:
        return json.loads(cached)
    resp = await _oai.embeddings.create(
        model=EMBED_MODEL, input=text[:8000], dimensions=EMBED_DIM
    )
    vec = resp.data[0].embedding
    await _redis.set(key, json.dumps(vec), ex=86400 * 7)
    return vec

async def memory_search(ticker: str, query: str,
                         top_k: int = 3, squad: str | None = None) -> list[dict]:
    """pgvector cosine similarity. ticker OR squad eşleşmeli."""
    vec = await embed(f"{ticker} {query}")
    async with async_session() as s:
        # database.md §4.1 SQL — ticker = current OR squad = current_squad
        stmt = (
            select(
                ThesisRow,
                ThesisRow.embedding.cosine_distance(vec).label("dist")
            )
            .where(
                (ThesisRow.ticker == ticker) |
                (ThesisRow.squad == squad if squad else False)
            )
            .where(ThesisRow.outcome != "pending")
            .order_by("dist")
            .limit(top_k)
        )
        rows = (await s.execute(stmt)).all()
    return [
        {
            "thesis_id": str(r.Thesis.id),
            "ticker": r.Thesis.ticker,
            "thesis_date": r.Thesis.thesis_date.isoformat(),
            "tldr": r.Thesis.tldr,
            "actual_return": r.Thesis.ground_truth_return,
            "outcome": r.Thesis.outcome,
            "distance": float(r.dist),
        }
        for r in rows if r.dist < DISTANCE_CUTOFF
    ]

async def memory_write_async(thesis: Thesis, user_id: str | None = None):
    """Tezi DB'ye ekle (embedding + metadata)."""
    vec = await embed(thesis.markdown[:8000])
    async with async_session() as s:
        s.add(ThesisRow(
            id=None,    # default gen_random_uuid
            user_id=user_id,
            ticker=thesis.ticker,
            squad=thesis.squad,
            user_mode=thesis.user_mode,
            thesis_md=thesis.markdown,
            tldr=thesis.tldr,
            bull_points=thesis.bull_points,
            bear_points=thesis.bear_points,
            catalysts=thesis.catalysts,
            confidence=thesis.confidence.total,
            confidence_breakdown=thesis.confidence.model_dump(),
            embedding=vec,
            outcome="pending",
            had_kaynaksiz_flag="[KAYNAKSIZ]" in (thesis.soft_flags or []),
        ))
        await s.commit()

# Devil's Advocate için ayrı tool
from strands import tool
from backend.tools._logged import logged_tool

@tool
@logged_tool(name="memory_base_rate")
async def memory_base_rate_tool(ticker: str, squad: str | None = None) -> dict:
    """Bu ticker/squad'da geçmiş tezlerin avg return'ü ve win-rate'i."""
    hits = await memory_search(ticker, "geçmiş tezler", top_k=10, squad=squad)
    if not hits:
        return {"sample_size": 0, "base_rate": None}
    returns = [h["actual_return"] for h in hits if h["actual_return"] is not None]
    correct = sum(1 for h in hits if h["outcome"] == "correct")
    return {
        "sample_size": len(hits),
        "avg_return_pct": round(sum(returns) / len(returns), 2) if returns else None,
        "win_rate_pct": round(correct / len(hits) * 100, 2),
    }
```

### 8.2.1 Gece Cron (02:00 UTC)

```python
# backend/jobs/memory_outcome_update.py
from datetime import date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
import asyncio
from backend.db.session import async_session
from backend.db.models import Thesis as ThesisRow
from scripts.product import prices

async def update_pending_outcomes():
    cutoff = date.today() - timedelta(days=7)
    async with async_session() as s:
        rows = (await s.execute(
            select(ThesisRow).where(
                ThesisRow.outcome == "pending",
                ThesisRow.thesis_date <= cutoff
            )
        )).scalars().all()
        for r in rows:
            try:
                df = await asyncio.to_thread(prices.get_ohlcv, r.ticker, days=10)
                current = float(df.iloc[-1]["Close"])
                # baseline: thesis_date günü kapanış (yfinance history içinde)
                base_df = await asyncio.to_thread(prices.get_ohlcv, r.ticker, days=100)
                # En yakın tarihi bul
                base_row = base_df[base_df.index.date <= r.thesis_date.date()].iloc[-1]
                base = float(base_row["Close"])
                ret = round((current - base) / base * 100, 2)
                r.price_7d = current
                r.ground_truth_return = ret
                # Bull tez (toplam confidence > 60) + getiri pozitif → correct
                bull = r.confidence > 60
                if (bull and ret > 5) or (not bull and ret < -5):
                    r.outcome = "correct"
                elif (bull and ret < -5) or (not bull and ret > 5):
                    r.outcome = "wrong"
                else:
                    r.outcome = "partial"
            except Exception as e:
                continue
        await s.commit()

def schedule_jobs():
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(update_pending_outcomes,
                  CronTrigger(hour=2, minute=0, timezone="UTC"),
                  id="memory_outcome_update")
    sched.start()
    return sched
```

### 8.3 PostgreSQL + pgvector Şema (tam)

`docs/database.md §1.2` birebir. SQLAlchemy ORM:

```python
# backend/db/models.py
from datetime import datetime, date
from typing import Optional
import uuid
from sqlalchemy import (
    String, Boolean, Integer, Float, Numeric, DateTime, Date, Text, ForeignKey, CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    tier: Mapped[str] = mapped_column(Text, default="free")
    user_mode_default: Mapped[str] = mapped_column(Text, default="default")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    __table_args__ = (
        CheckConstraint("tier IN ('free','pro','b2b')"),
        CheckConstraint("user_mode_default IN ('default','conservative')"),
    )

class WatchlistItem(Base):
    __tablename__ = "watchlist"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Thesis(Base):
    __tablename__ = "theses"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    squad: Mapped[str] = mapped_column(Text, nullable=False)
    user_mode: Mapped[str] = mapped_column(Text, nullable=False)
    thesis_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    thesis_md: Mapped[str] = mapped_column(Text, nullable=False)
    tldr: Mapped[Optional[str]] = mapped_column(Text)
    bull_points: Mapped[Optional[dict]] = mapped_column(JSONB)
    bear_points: Mapped[Optional[dict]] = mapped_column(JSONB)
    catalysts: Mapped[Optional[dict]] = mapped_column(JSONB)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    confidence_breakdown: Mapped[Optional[dict]] = mapped_column(JSONB)
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(768))
    price_at_thesis: Mapped[Optional[float]] = mapped_column(Numeric)
    price_7d: Mapped[Optional[float]] = mapped_column(Numeric)
    price_30d: Mapped[Optional[float]] = mapped_column(Numeric)
    price_90d: Mapped[Optional[float]] = mapped_column(Numeric)
    ground_truth_return: Mapped[Optional[float]] = mapped_column(Float)
    outcome: Mapped[str] = mapped_column(Text, default="pending")
    had_kaynaksiz_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        CheckConstraint("outcome IN ('correct','partial','wrong','pending')"),
        Index("idx_theses_embedding", "embedding",
              postgresql_using="ivfflat",
              postgresql_ops={"embedding": "vector_cosine_ops"}),
        Index("idx_theses_ticker_date", "ticker", "thesis_date"),
    )

class ToolCallLog(Base):
    __tablename__ = "tool_call_logs"
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thesis_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("theses.id", ondelete="CASCADE"))
    agent_id: Mapped[str] = mapped_column(Text, nullable=False)
    tool_name: Mapped[str] = mapped_column(Text, nullable=False)
    args: Mapped[Optional[dict]] = mapped_column(JSONB)
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, default="ok")
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    __table_args__ = (Index("idx_tool_call_logs_thesis", "thesis_id"),)

class Citation(Base):
    __tablename__ = "citations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    call_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tool_call_logs.call_id"))
    is_kaynaksiz: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Migration komutu sırası:**

```bash
cd backend
alembic init migrations
# alembic.ini: sqlalchemy.url = postgresql://...
# env.py: target_metadata = Base.metadata
alembic revision --autogenerate -m "initial schema"
# revision dosyasının üst satırına `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` ekle
alembic upgrade head
```

### 8.3.1 Session (async)

```python
# backend/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.config.settings import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=10)
async_session = async_sessionmaker(engine, expire_on_commit=False)
```

### 8.4 Fixture Sistem

```python
# backend/services/fixture_store.py
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

FIXTURE_ROOT = Path("fixtures")
DEFAULT_TTL_HOURS = 48

class FixtureWriter:
    @staticmethod
    async def write(domain: str, key: str, payload: Any, provider: str = "primary"):
        path = FIXTURE_ROOT / domain / f"{key}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        content = {
            "key": f"{domain}:{key}",
            "provider": provider,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "ttl_hours": DEFAULT_TTL_HOURS,
            "payload": payload,
        }
        path.write_text(json.dumps(content, default=str, ensure_ascii=False, indent=2))

class FixtureLoader:
    @staticmethod
    def load(domain: str, key: str, warn_stale: bool = True) -> dict | None:
        path = FIXTURE_ROOT / domain / f"{key}.json"
        if not path.exists():
            return None
        content = json.loads(path.read_text())
        fetched = datetime.fromisoformat(content["fetched_at"])
        if datetime.now(timezone.utc) - fetched > timedelta(hours=content["ttl_hours"]):
            if warn_stale:
                import structlog
                structlog.get_logger().warning("fixture_stale",
                    domain=domain, key=key, age_hours=int((datetime.now(timezone.utc) - fetched).total_seconds()/3600))
        return content["payload"]
```

### 8.4.1 Pre-warm Script

```python
# scripts/warmup.py
"""Demo öncesi 10 hisse için tüm cache + fixture'ları doldur."""
import asyncio
from backend.services.bundle_async import build_thesis_bundle_async
from backend.services.fixture_store import FixtureWriter

DEMO_TICKERS = ["ASELS", "GARAN", "TUPRS", "BIMAS", "EREGL",
                "THYAO", "AKBNK", "KCHOL", "SISE", "ULKER"]

async def warmup_all():
    for t in DEMO_TICKERS:
        print(f"→ {t} ...")
        bundle = await build_thesis_bundle_async(t)
        # Bundle'ı fixture'a yaz (kill-switch fallback)
        await FixtureWriter.write("bundle", t, bundle)
        # Redis cache'i de doldur (zaten bundle_async içinde oluyor)
    print("✅ warmup tamamlandı")

if __name__ == "__main__":
    asyncio.run(warmup_all())
```

```python
# scripts/refresh_fixtures.py
"""48h+ stale fixture'ları yeniden üret."""
# warmup.py + ek olarak fixtures/thesis/<ticker>/<date>.json
# pre-baked tez (kill-switch fallback için)
```

---

## 9. Confidence Score

`docs/agents.md §6` formülü. **Bundle.errors ve sentiment hesabı dahil.**

### 9.1 Tam İmplementasyon

```python
# backend/services/confidence.py
from sqlalchemy import select
from backend.db.session import async_session
from backend.db.models import ToolCallLog
from backend.schemas.synthesis import ConfidenceBreakdown
from backend.schemas.macro import MacroContext
from backend.schemas.technical import TechnicalAnalysis
from backend.schemas.fundamental import FundamentalAnalysis
from backend.schemas.critique import Critique

POSITIVE_TR = [
    "yükseliş", "kâr artışı", "kar artışı", "rekor", "büyüme", "beklenti üzeri",
    "olumlu", "anlaşma", "sözleşme imzaland", "yatırım", "açılış", "ihale kazand"
]
NEGATIVE_TR = [
    "düşüş", "zarar", "iflas", "soruşturma", "ceza", "iptal", "uyarı",
    "kâr azalış", "kar azalış", "satış", "olumsuz", "fesh"
]

async def compute_confidence(
    thesis_id: str,
    bundle: dict,
    technical: TechnicalAnalysis,
    fundamental: FundamentalAnalysis,
    macro_ctx: MacroContext,
    memory_hits: list[dict],
    critique: Critique,
    user_mode: str,
) -> ConfidenceBreakdown:
    # --- 1. Data Quality (bundle.errors + tool log success rate) ---
    async with async_session() as s:
        rows = (await s.execute(
            select(ToolCallLog.status, ToolCallLog.cache_hit)
            .where(ToolCallLog.thesis_id == thesis_id)
        )).all()
    total = max(len(rows), 1)
    ok = sum(1 for r in rows if r.status == "ok")
    cache_hits = sum(1 for r in rows if r.cache_hit)
    base_dq = int(100 * (0.7 * ok / total + 0.3 * cache_hits / total))
    # Bundle.errors penalty: her missing field -5 puan
    errors_count = len(bundle.get("errors", {}))
    data_quality = max(0, base_dq - 5 * errors_count)

    # --- 2. Technical Score (worker'ın momentum_score'u) ---
    technical_score = technical.momentum_score

    # --- 3. Fundamental Score (aggregate squad_metrics + analyst recommendation) ---
    fundamental_score = _aggregate_fundamental_score(fundamental)

    # --- 4. News/Macro Alignment (Türkçe keyword sentiment) ---
    news_text = " ".join(
        (n.get("title", "") + " " + n.get("summary", "")).lower()
        for n in (bundle.get("company_news", []) + bundle.get("market_news", []))
    )
    pos = sum(1 for w in POSITIVE_TR if w in news_text)
    neg = sum(1 for w in NEGATIVE_TR if w in news_text)
    sentiment_raw = pos - neg            # -∞..+∞
    sentiment_norm = max(-50, min(50, sentiment_raw * 5))
    news_macro = 50 + sentiment_norm     # 0..100

    # --- 5. Memory Base Rate ---
    memory_base = _memory_base_rate(memory_hits)

    # --- 6. Devil's Advocate Inverse ---
    devils_inverse = 100 - critique.overall_critique_strength

    # --- Total weighted ---
    total_score = int(
        0.25 * data_quality
        + 0.20 * technical_score
        + 0.20 * fundamental_score
        + 0.15 * news_macro
        + 0.10 * memory_base
        + 0.10 * devils_inverse
    )
    if user_mode == "conservative":
        total_score = min(total_score, 70)

    return ConfidenceBreakdown(
        data_quality=data_quality,
        technical_score=technical_score,
        fundamental_score=fundamental_score,
        news_macro_alignment=news_macro,
        memory_base_rate=memory_base,
        devils_advocate_inverse=devils_inverse,
        total=total_score,
    )

def _aggregate_fundamental_score(f: FundamentalAnalysis) -> int:
    """analyst recommendation + ratios sağlığından 0-100."""
    rec = (f.analyst_consensus.get("recommendation") or "").upper()
    base = {"AL": 75, "TUT": 55, "SAT": 30}.get(rec, 50)
    upside = f.analyst_consensus.get("upside_pct") or 0
    delta = min(15, max(-15, int(upside / 3)))   # ±%45 upside → ±15 puan
    return max(0, min(100, base + delta))

def _memory_base_rate(hits: list[dict]) -> int:
    """Geçmiş tezlerin avg actual_return → 0..100."""
    if not hits:
        return 50  # neutral
    returns = [h.get("actual_return") for h in hits if h.get("actual_return") is not None]
    if not returns:
        return 50
    avg = sum(returns) / len(returns)        # -100..+100
    return max(0, min(100, int(50 + avg / 2)))
```

### 9.2 UI Render (recharts)

`docs/agents.md §6`: horizontal stacked bar, her bileşen renkli segment. Frontend için bilgi:

```json
{
  "data_quality":           {"value": 80, "color": "#10b981", "weight": 0.25},
  "technical_score":        {"value": 65, "color": "#3b82f6", "weight": 0.20},
  "fundamental_score":      {"value": 72, "color": "#8b5cf6", "weight": 0.20},
  "news_macro_alignment":   {"value": 60, "color": "#f59e0b", "weight": 0.15},
  "memory_base_rate":       {"value": 70, "color": "#ec4899", "weight": 0.10},
  "devils_advocate_inverse":{"value": 45, "color": "#ef4444", "weight": 0.10},
  "total": 68
}
```

---

## 10. Format Normalizer

`backend/utils/format.py` — tam implementasyon:

```python
from datetime import datetime, date
from typing import Any
import re
from dateutil import parser as dtparser

# --- Numeric ---
def fmt_tl(value: Any) -> str:
    """485646000000 → '485.6 milyar ₺'. None → '—'."""
    if value in (None, "", "null"):
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)
    if abs(v) >= 1e12: return f"{v/1e12:.2f} trilyon ₺"
    if abs(v) >= 1e9:  return f"{v/1e9:.1f} milyar ₺"
    if abs(v) >= 1e6:  return f"{v/1e6:.1f} milyon ₺"
    if abs(v) >= 1e3:  return f"{v/1e3:.1f} bin ₺"
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} ₺"

def fmt_pct(v: Any) -> str:
    """0.392 → '%39,2'. 39.2 → '%39,2' (>1 ise zaten yüzde)."""
    if v is None: return "—"
    n = float(v) * 100 if abs(float(v)) < 1 else float(v)
    return f"%{n:.1f}".replace(".", ",")

# --- Date ---
_RFC_RE = re.compile(r"^[A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}")

def fmt_date(s: Any) -> str:
    """Çoklu format → ISO 'YYYY-MM-DD'.
    Destekler: '12-05-2026', 'Tue, 12 May 2026 15:56:00 GMT', '2026-04-29T...', date obj."""
    if s in (None, "", "null"): return "—"
    if isinstance(s, (date, datetime)):
        return s.isoformat()[:10]
    s = str(s).strip()
    try:
        # DD-MM-YYYY için dayfirst
        if re.match(r"^\d{2}-\d{2}-\d{4}", s):
            return dtparser.parse(s, dayfirst=True).date().isoformat()
        return dtparser.parse(s).date().isoformat()
    except Exception:
        return s

# --- Bundle normalize ---
def normalize_bundle(bundle: dict) -> dict:
    """Tüm string-sayı, ham-tarih alanlarını standardize et.
    Synthesizer'a vermeden önce çağır."""
    out = dict(bundle)
    # Financials sayı cast
    if isinstance(out.get("financials"), dict):
        out["financials"] = {
            k: (float(v) if isinstance(v, str) and v.replace(".","").replace("-","").isdigit() else v)
            for k, v in out["financials"].items()
        }
    # Disclosures date normalize
    if isinstance(out.get("disclosures"), list):
        out["disclosures"] = [
            {**d, "date": fmt_date(d.get("date"))}
            for d in out["disclosures"]
        ]
    # News date normalize
    for key in ("company_news", "market_news"):
        if isinstance(out.get(key), list):
            out[key] = [
                {**n, "date_iso": fmt_date(n.get("date") or n.get("published_at"))}
                for n in out[key]
            ]
    return out
```

### 10.1 Synthesizer'a Verilen Format (insan-okur)

Bundle'ı raw vermek yerine summarize edilmiş, formatted bir snapshot ver:

```python
def render_bundle_for_synthesizer(bundle: dict) -> str:
    """Markdown formatında compact özet."""
    b = normalize_bundle(bundle)
    fin = b.get("financials", {})
    return f"""
**Makro:** USD/TRY={b['macro'].get('usd_try')}, TÜFE YoY={fmt_pct(b['macro'].get('tufe_yoy_pct'))}, Politika Faizi=%{b['macro'].get('policy_rate')}
**Şirket:** {b['company'].get('title')} ({b['ticker']})
**Fiyat:** Son kapanış {fmt_tl(b['price'].get('last_close'))}, 90g değişim {fmt_pct(b['price'].get('change_pct'))}
**Teknik:** trend={b['technical']['signal']['trend']}, RSI={b['technical'].get('rsi_14')}, ATR={b['technical'].get('atr_14')}
**Finansal ({fin.get('period')}):** Hasılat {fmt_tl(fin.get('Hasılat'))}, Dönen V. {fmt_tl(fin.get('Dönen Varlıklar'))}
**Analist:** {b['analyst'].get('recommendation')}, hedef {fmt_tl(b['analyst'].get('target_price'))}, upside {fmt_pct(b['analyst'].get('upside_potential'))}
**Eksik veri:** {list(b.get('errors', {}).keys()) or 'yok'}
"""
```

---

## 11. WebSocket Streaming (FastAPI)

### 11.1 Event Şemaları (Tam JSON)

| Event | Payload | Tetikleyen |
|---|---|---|
| `stage` | `{"type":"stage","name":"bundle_done\|stage1_done\|workers_done\|devil_done\|synth_start","data":{...}}` | Orchestrator |
| `tool_call` | `{"type":"tool_call","tool_name":"get_ohlcv","call_id":"uuid","args":{...}}` | logged_tool wrapper |
| `token` | `{"type":"token","text":"kelime parçası"}` | Synthesizer stream |
| `thesis_complete` | `{"type":"thesis_complete","thesis_id":"uuid","confidence":68,"had_soft_flag":false}` | Orchestrator son adım |
| `error` | `{"type":"error","message":"...","fatal":bool,"retrying":bool}` | Herhangi bir failure |
| `degraded` | `{"type":"degraded","reason":"timeout\|3fail\|manual","fixture_source":"..."}` | Kill-switch |

### 11.2 Endpoint İmplementasyonu

```python
# backend/api/ws.py
import asyncio
import uuid
from fastapi import WebSocket, WebSocketDisconnect, Query
from backend.agents.orchestrator import run_thesis_pipeline
import structlog

logger = structlog.get_logger()
HEARTBEAT_SECONDS = 30

@app.websocket("/ws/thesis/{session_id}")
async def thesis_ws(ws: WebSocket, session_id: str,
                     token: str | None = Query(None)):
    await ws.accept()
    # Auth (opsiyonel — §16)
    user_id = await _resolve_user(token)
    try:
        msg = await asyncio.wait_for(ws.receive_json(), timeout=10)
        ticker = msg["ticker"].upper()
        user_mode = msg.get("user_mode", "default")
    except Exception as e:
        await ws.send_json({"type":"error","message":"invalid_connect","fatal":True})
        await ws.close(code=1008)
        return

    queue: asyncio.Queue = asyncio.Queue()

    async def ws_send(event: dict):
        await queue.put(event)

    async def producer():
        try:
            await run_thesis_pipeline(ticker, user_id=user_id,
                                       user_mode=user_mode, ws_send=ws_send)
        except Exception as e:
            await queue.put({"type":"error","message":str(e)[:200],"fatal":True})
        await queue.put(None)  # sentinel

    async def consumer():
        last_msg = asyncio.get_event_loop().time()
        while True:
            try:
                ev = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                # Heartbeat
                await ws.send_json({"type":"ping","ts":int(asyncio.get_event_loop().time())})
                continue
            if ev is None:
                break
            await ws.send_json(ev)

    prod = asyncio.create_task(producer())
    try:
        await consumer()
    except WebSocketDisconnect:
        prod.cancel()
        logger.warning("ws_disconnect", session_id=session_id, ticker=ticker)
    await ws.close(code=1000)
```

### 11.3 Close Codes

| Code | Anlam |
|---|---|
| 1000 | Normal close (tez tamamlandı) |
| 1006 | Anormal (network) — client reconnect |
| 1008 | Policy violation (auth / invalid input) |
| 1011 | Server error (orchestrator crash) |

### 11.4 Frontend Protocol Beklentisi

`docs/stack.md §3` ResilientThesisClient'i bu protokole uyar:
1. WS açılır → server `accept`
2. Client ilk mesaj: `{"ticker":"ASELS","user_mode":"default"}` (10s timeout)
3. Server event stream başlar
4. 30s'de bir `{"type":"ping"}` → client cevap vermek zorunda değil, sadece connection alive
5. `thesis_complete` veya `error fatal=true` → server close

---

## 12. Demo Kill-Switch

### 12.1 Watchdog + FailCounter

```python
# backend/services/killswitch.py
from contextvars import ContextVar
from collections import defaultdict
from backend.services.fixture_store import FixtureLoader
import asyncio
import time
import structlog

logger = structlog.get_logger()
FAIL_THRESHOLD = 3

# Per-session counter (session_id -> fail count)
_fail_counters: dict[str, int] = defaultdict(int)
current_session_ctx: ContextVar[str] = ContextVar("session_id", default="default")

def register_tool_failure():
    sid = current_session_ctx.get()
    _fail_counters[sid] += 1
    if _fail_counters[sid] >= FAIL_THRESHOLD:
        raise KillSwitchTriggered(reason="3fail")

class KillSwitchTriggered(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"kill-switch: {reason}")

async def serve_fixture_thesis(ticker: str, user_mode: str,
                                ws_send, reason: str):
    """Pre-baked tezi token-by-token yapay delay ile stream'le."""
    fix = FixtureLoader.load("thesis", f"{ticker}/latest", warn_stale=False)
    if not fix:
        # fallback: en yakın hisse
        fix = FixtureLoader.load("thesis", "ASELS/latest")
    if not fix:
        await ws_send({"type":"error","message":"no_fixture","fatal":True})
        return
    await ws_send({"type":"degraded","reason":reason,"fixture_source":ticker})
    # Yapay token streaming (50-100ms gecikme, gerçekçi görünüm)
    md = fix.get("markdown", "")
    for chunk in _chunk_text(md, size=20):
        await ws_send({"type":"token","text":chunk})
        await asyncio.sleep(0.07)
    await ws_send({"type":"thesis_complete",
                   "thesis_id":fix.get("thesis_id","demo"),
                   "confidence":fix.get("confidence",65),
                   "had_soft_flag":False})
    logger.warning("kill_switch_served", ticker=ticker, reason=reason)

def _chunk_text(s: str, size: int = 20):
    for i in range(0, len(s), size):
        yield s[i:i+size]
```

### 12.2 Manuel Tetik

```python
# backend/api/ws.py — middleware veya endpoint başında
@app.middleware("http")
async def kill_switch_middleware(request, call_next):
    if request.query_params.get("force_demo") == "1":
        request.state.force_fixture = True
    return await call_next(request)
```

### 12.3 Otomatik Tetikleyiciler

1. **Timeout 90s** — `asyncio.wait_for` orchestrator wrap'inde (§6.6).
2. **3 tool fail** — `logged_tool` exception path'inde `register_tool_failure()` çağrısı:

```python
# logged_tool exception handler'a ekle:
except Exception as e:
    status, err = "error", str(e)[:500]
    try:
        register_tool_failure()
    except KillSwitchTriggered:
        # Orchestrator catch eder, serve_fixture_thesis çağırır
        raise
    raise
```

3. **Gemini 429** — `httpx`/Strands hata sınıfından yakala:

```python
except (RateLimitError, ResourceExhausted) as e:
    raise KillSwitchTriggered(reason="rate_limit")
```

### 12.4 Pre-baked Tez Fixture Şeması

`fixtures/thesis/<TICKER>/latest.json`:

```json
{
  "ticker": "ASELS",
  "generated_at": "2026-05-12T08:00:00Z",
  "user_mode": "default",
  "thesis_id": "demo-asels-20260512",
  "markdown": "## TL;DR ...\n...",
  "confidence": 72,
  "model_versions": {"pro": "gemini-2.5-pro", "flash": "gemini-2.5-flash"}
}
```

10 pre-warm hisse: `ASELS, GARAN, TUPRS, BIMAS, EREGL, THYAO, AKBNK, KCHOL, SISE, ULKER`.

---

## 13. Sprint Planı — 7 Gün, 3 Kişi

`docs/sprint.md` birebir. Backend implementasyonu **A** (Agent Lead), data **B** (DevOps Lead), frontend **C** (Frontend Lead).

### 13.1 Rol Dağılımı

| Rumuz | Rol | Stack |
|---|---|---|
| **A** | Agent Lead | Strands, Gemini SDK, pydantic, Synthesizer/Devil's prompt |
| **B** | Data/DevOps | Postgres+pgvector, Redis, Docker, alembic, CI, fixture, kill-switch |
| **C** | Frontend | Next.js 15, Tailwind, shadcn/ui, recharts, WebSocket client |

### 13.2 Gün-Gün

| Gün | A | B | C |
|---|---|---|---|
| 1 | Repo iskelet, FastAPI `/health`, **Gemini Tier 1 paid aktif** (09:00 başla), dummy agent | docker-compose (postgres+pgvector, redis), alembic init, **TCMB+MKK kayıt 09:00**, .env.example | Next.js iskelet, Tailwind, layout, mock chat UI |
| 2 | BaseAgent, Macro Context (Flash, 15dk cache), Orchestrator iskeleti | DataProvider chain + Redis cache wrapper, sector_map.yaml, GARAN NIM unit test | `/api/macro` UI bind, watchlist component, chat input |
| 3 | Sector Router, Technical + Fundamental Worker (5 squad-spesifik prompt), asyncio.gather | KAP scraper fallback (Playwright), Pydantic worker schemas, citations tablosu yazma | Thesis Viewer iskelet, worker status UI, squad badge |
| 4 🎯 | **Devil's Advocate Pro + Synthesizer Pro streaming**, citation validator (1-retry + soft flag), user_mode taslak | DB persist (embedding + pgvector), Memory write-only, ratios integration test, smoke CLI | Markdown stream render, bull/bear collapsible, citation tooltip, confidence recharts bar |
| 5 | WebSocket endpoint, Memory similarity inject (top_k=3), Orchestrator WS-aware | Memory read SQL (cosine), gece cron iskeleti, integration tests, **GitHub Actions PR** | WS client + reconnect + REST polling degrade, typing animation, "Geçmiş Tezler" panel |
| 6 | Conservative mode tam (bear başa, cap=70, temettü vurgulu), **pre-warm cache mekanizması** | Coverage >%70, smoke 5 hisse, gece cron çalışır, **kill-switch + fixture'lar**, deploy | Conservative UI toggle (Ali Bey default), demo animasyon, error boundaries, mobile |
| 7 | Sunum teknik kısım, canlı demo 3 persona, Q&A notları | Prod smoke, pre-warm final populate, repo temizlik, deploy URL test | Sunum ürün kısım, **demo video 3-5 dk scripted** |

### 13.3 Daily Ritüel

- **09:00** — 15 dk standup
- **12:30** — Hızlı sync
- **18:00** — Demo dry run (Gün 4+, 5 dk)
- **22:00** — Soft cutoff (commit + push)

### 13.4 Bağımlılık Sırası

**Blocker önceliği:** B → A → C (data layer → agent → UI). A ve C, B'nin bittiği iş üstüne kurar.

### 13.5 Risk Önceliği

| Öncelik | Feature | Fallback |
|---|---|---|
| 🔴 Vazgeçilmez | Tek hisse tam tez + citation + DB write | MVP yok |
| 🟡 Önemli | WebSocket + reconnect | REST polling |
| 🟡 Önemli | Memory similarity inject | Sadece write |
| 🟡 Önemli | Conservative mode | UI toggle var, backend default |
| 🟡 Önemli | Kill-switch | Manuel "fixture göster" |
| 🟢 Nice-to-have | Pre-warmed cache | Canlı 60s |
| 🟢 Nice-to-have | Coverage >%70 | Citation + router test |

---

## 14. Test Stratejisi

### 14.1 pytest Konfigürasyonu

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["backend/tests"]
markers = [
  "unit: unit tests, mock all I/O",
  "integration: tests with real DB + mocked LLM",
  "smoke: nightly tests with real LLM + API",
  "live: tests that hit production APIs (gated by env)",
]
addopts = "-q --strict-markers --cov=backend --cov-report=term-missing"
```

### 14.2 Critical Path Coverage (>%70 zorunlu)

| Modül | Coverage Hedefi | Anahtar Test |
|---|---|---|
| `backend/agents/citation_validator.py` | **%100** | sahte UUID, sayı mismatch, retry, selective flag |
| `backend/agents/sector_router.py` | %90 | 50 BIST hisse → doğru squad |
| `backend/services/confidence.py` | %85 | tüm bileşenler + conservative cap |
| `backend/tools/_logged.py` | %85 | exception path, cache_hit flag, context vars |
| `backend/agents/memory.py` | %75 | cosine ordering, threshold, embed cache |
| `backend/services/bundle_async.py` | %75 | partial failure, errors dict |
| `backend/services/providers/base.py` | %80 | chained fallback, timeout |

### 14.3 Mock LLM (Gemini)

```python
# backend/tests/mocks/gemini_mock.py
from unittest.mock import AsyncMock
from pathlib import Path
import json

FIXTURES = Path(__file__).parent / "responses"

def load_response(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text())

def make_mock_agent(response_name: str):
    """Strands Agent'ını monkeypatch'le.

    Fixture: backend/tests/mocks/responses/macro_thyao.json
    {
        "structured_output": {
            "paragraph": "USD/TRY 45.29 [kaynak: <uuid>]. ...",
            "indicators": {"usd_try": 45.29, ...},
            "citations": [{"text": "...", "call_id": "<uuid>", "confidence": 90}]
        },
        "stream_events": [{"text": "USD"}, {"text": "/TRY"}, ...]
    }
    """
    resp = load_response(response_name)
    mock = AsyncMock()
    mock.invoke_async.return_value = type("Result", (),
        {"structured_output": resp["structured_output"]})()
    async def gen():
        for e in resp.get("stream_events", []):
            yield type("Event", (), e)()
    mock.stream_async = gen
    return mock

# Kullanım:
# @pytest.fixture
# def patched_macro(monkeypatch):
#     mock = make_mock_agent("macro_thyao")
#     monkeypatch.setattr("backend.agents.macro_context.macro_context_agent", mock)
#     return mock
```

### 14.4 Test Klasörü Yapısı

```
backend/tests/
├── unit/
│   ├── test_citation_validator.py
│   ├── test_sector_router.py
│   ├── test_confidence.py
│   ├── test_logged_tool.py
│   ├── test_format.py
│   └── test_bundle_async.py
├── integration/
│   ├── test_pipeline_e2e.py            # Mock LLM, real DB
│   ├── test_memory_roundtrip.py
│   └── test_citation_loop.py
├── smoke/
│   └── test_5_tickers.py               # @pytest.mark.smoke, real LLM
├── live/
│   └── test_live_apis.py               # @pytest.mark.live, real APIs
├── fixtures/
│   ├── broken_citation.json
│   ├── bist50_squad_truth.csv
│   ├── garan_q3_expected.json
│   └── seed_theses.sql                 # 3 fake tez
└── mocks/
    ├── gemini_mock.py
    └── responses/
        ├── macro_thyao.json
        ├── technical_asels.json
        └── synth_thyao_default.json
```

### 14.5 Unit Test Örnekleri

```python
# backend/tests/unit/test_citation_validator.py
import pytest
from backend.agents.citation_validator import _number_matches_in_text

@pytest.mark.unit
def test_number_matching_milyar():
    assert _number_matches_in_text("485,6 milyar", "485646000000")
    assert _number_matches_in_text("485,6 milyar ₺", "485600000000")
    assert not _number_matches_in_text("100 milyar", "485000000000")

@pytest.mark.unit
def test_pct_match():
    assert _number_matches_in_text("%39,2", "tufe_yoy_pct: 39.2")
```

### 14.6 GitHub Actions CI

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: "0 23 * * *"   # nightly 23:00 UTC

jobs:
  unit-integration:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: {POSTGRES_PASSWORD: test, POSTGRES_DB: thesisforge_test}
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: "3.11"}
      - run: pip install -e ".[dev]"
      - run: alembic upgrade head
        env: {DATABASE_URL: postgresql+asyncpg://postgres:test@localhost:5432/thesisforge_test}
      - run: pytest -m "unit or integration" --cov
      - uses: codecov/codecov-action@v4

  smoke:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    env:
      GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      TCMB_EVDS_KEY:  ${{ secrets.TCMB_EVDS_KEY }}
      MKK_API_KEY:    ${{ secrets.MKK_API_KEY }}
      MKK_API_SECRET: ${{ secrets.MKK_API_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -e ".[dev]"
      - run: pytest -m smoke -v
```

### 14.7 Smoke Test

```python
# backend/tests/smoke/test_5_tickers.py
import pytest
from backend.agents.orchestrator import run_thesis_pipeline

@pytest.mark.smoke
@pytest.mark.parametrize("ticker", ["ASELS", "GARAN", "TUPRS", "BIMAS", "THYAO"])
async def test_full_pipeline_smoke(ticker):
    thesis = await run_thesis_pipeline(ticker)
    assert thesis.markdown
    assert len(thesis.markdown) > 500
    assert thesis.confidence.total > 0
    assert len(thesis.citations) > 0
    # Citation pass oranı > %80
    kaynaksiz_count = thesis.markdown.count("[KAYNAKSIZ]")
    assert kaynaksiz_count / max(len(thesis.citations), 1) < 0.2
```

---

## 15. Risk Tablosu (15 risk — `docs/risks.md §1` tam)

| # | Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|---|
| 1 | KAP RSS kırılır | Orta | Düşük | MKK API primary, RSS fallback, 48h fixture |
| 2 | yfinance Yahoo politika değişir | Düşük | Yüksek | isyatirim secondary, TwelveData free tier 3., fixture |
| 3 | Gemini rate limit (429 Pro 360 RPM, Flash 1000 RPM) | Orta | Yüksek | Exponential backoff (1/2/4s), Flash öncelikli, cache agresif, kill-switch |
| 4 | Citation validator sonsuz loop | Çözüldü | — | 1-retry + `[KAYNAKSIZ]` soft pass |
| 5 | Devil's Advocate prompt zayıf | Orta | Yüksek | 3-4 prompt version A/B test, Gün 4-5 |
| 6 | BIST kapalı demo (akşam/hafta sonu) | Düşük | Orta | Pre-warmed cache + kill-switch fixture |
| 7 | Strands A2A protocol olgun değil | Çözüldü | — | Agent-as-Tool fallback (basit feedback loop) |
| 8 | KAP scraping legal/ToS | Düşük | Yüksek (legal) | MKK API resmi → RSS-first → saygılı scrape (1 req/sn, robots, UA) |
| 9 | TA-Lib kurulum zorluğu (Linux) | Çözüldü | — | pandas-ta (saf Python) |
| 10 | Sunum sırasında pipeline çöker | Orta | Yüksek | Demo kill-switch (90s + 3fail) |
| 11 | WebSocket bağlantı kopar | Orta | Düşük | Reconnect + REST polling degrade |
| 12 | Sentiment yanlış (Türkçe NLP) | Çözüldü | — | Sentiment Worker v2'ye atıldı; keyword tabanlı basit |
| 13 | Gemini API key Google tarafından askıya alınır | Düşük | Çok Yüksek | Tek hesap + Tier 1 paid, ToS uyumlu |
| 14 | MKK API onayı 7 günden uzun sürer | Orta | Orta | KAP RSS primary'de kal, Gün 1 sabah başvur |
| 15 | isyatirim/borsapy IP-ban | Düşük | Yüksek | ≤1 req/sn, agresif cache, yfinance secondary |

### 15.1 Risk Yanıt Hiyerarşisi

Bir tool fail durumunda sıralı tepki:

1. **Cache hit kontrol** → stale ile devam (data_quality flag düşük)
2. **Secondary provider** → primary fail
3. **Fixture** → ikisi de fail
4. **`DataUnavailable` exception** → Synthesizer "veri eksik" notu, confidence cap
5. **Kill-switch tetikle** → 90s timeout veya 3 ardışık fail
6. **Pre-baked tez göster** → kill-switch sonrası, "⚠️ Demo modu" rozeti

---

## 16. REST API + Auth

### 16.1 Endpoint Listesi (FastAPI)

```python
# backend/api/rest.py
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.schemas.synthesis import Thesis
from backend.schemas.sector import SectorAssignment
from backend.services.persistence import get_thesis, get_thesis_status, list_watchlist, add_watchlist, remove_watchlist
from backend.tools.data_tools import macro_context_tool

api = APIRouter(prefix="/api")

@api.post("/thesis", response_model=dict)
async def create_thesis(payload: dict, user_id: str = Depends(_resolve_user_dep)):
    """Sync REST fallback. WebSocket'ten daha yavaş ama streaming kopuk."""
    from backend.agents.orchestrator import run_thesis_pipeline
    thesis = await run_thesis_pipeline(
        ticker=payload["ticker"], user_id=user_id,
        user_mode=payload.get("user_mode", "default"),
    )
    return {"thesis_id": str(thesis.ticker), "thesis": thesis.model_dump()}

@api.get("/thesis/{thesis_id}", response_model=Thesis)
async def get_thesis_endpoint(thesis_id: str):
    t = await get_thesis(thesis_id)
    if not t: raise HTTPException(404)
    return t

@api.get("/thesis/{thesis_id}/status")
async def thesis_status(thesis_id: str, since_offset: int = 0):
    """WS bağlantısı koparsa client REST polling'e düşer (stack.md §3)."""
    return await get_thesis_status(thesis_id, since_offset)

@api.get("/watchlist")
async def watchlist(user_id: str = Depends(_resolve_user_dep)):
    return await list_watchlist(user_id)

@api.post("/watchlist/{ticker}")
async def add_to_watchlist(ticker: str, user_id: str = Depends(_resolve_user_dep)):
    return await add_watchlist(user_id, ticker.upper())

@api.delete("/watchlist/{ticker}")
async def del_from_watchlist(ticker: str, user_id: str = Depends(_resolve_user_dep)):
    return await remove_watchlist(user_id, ticker.upper())

@api.get("/macro")
async def get_macro_cached():
    """UI'nın sol panelde gösterdiği makro snapshot (15dk cache)."""
    result = await macro_context_tool()
    return result["data"]

@api.post("/chat")
async def chat_fallback(payload: dict, user_id: str = Depends(_resolve_user_dep)):
    """WS desteklenmeyen client için tek seferlik tez."""
    return await create_thesis(payload, user_id=user_id)
```

### 16.2 Auth Stratejisi — Demo-First

Hackathon scope: **JWT optional, anonymous session_id ile çalış**. Production'da Supabase Auth.

```python
# backend/api/auth.py
from fastapi import Header, Depends
from uuid import UUID
import jwt
from backend.config.settings import settings

ANON_USER_ID = UUID("00000000-0000-0000-0000-000000000000")

async def _resolve_user_dep(authorization: str | None = Header(None)) -> UUID:
    """JWT varsa decode, yoksa anonymous user (DB'de pre-seeded)."""
    if not authorization or not authorization.startswith("Bearer "):
        return ANON_USER_ID
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return UUID(payload["sub"])
    except Exception:
        return ANON_USER_ID

async def _resolve_user(token: str | None) -> UUID:
    """WebSocket için (query param)."""
    if not token:
        return ANON_USER_ID
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return UUID(payload["sub"])
    except Exception:
        return ANON_USER_ID
```

**Anonymous user seed (alembic migration):**

```python
op.execute("""
INSERT INTO users (id, email, tier, user_mode_default)
VALUES ('00000000-0000-0000-0000-000000000000', 'anon@local', 'free', 'default')
ON CONFLICT (id) DO NOTHING;
""")
```

### 16.3 CORS

```python
# backend/api/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ThesisForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
                   "https://thesisforge.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 16.4 Health & OpenAPI

```python
@app.get("/health")
async def health():
    """Deploy probe için."""
    return {"status": "ok", "mode": settings.THESISFORGE_MODE}

# OpenAPI otomatik /docs ve /openapi.json'da
```

---

## 17. Observability

### 17.1 OpenTelemetry Setup

```python
# backend/observability.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from backend.config.settings import settings

def setup_tracing():
    resource = Resource.create({"service.name": "thesisforge-backend"})
    provider = TracerProvider(resource=resource)
    if settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        # Production: Jaeger / Datadog
        exporter = OTLPSpanExporter(endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT)
    else:
        # Development: stdout
        exporter = ConsoleSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(__name__)

tracer = setup_tracing()
```

**Span naming convention:**
- `agent.{name}.invoke` — agent çağrısı (macro_context, technical_worker, ...)
- `tool.{name}.call` — tool çağrısı (get_ohlcv, get_financials, ...)
- `pipeline.thesis.run` — orchestrator
- `pipeline.stage.{name}` — bundle_async, stage1, workers, devil, synth, persist
- `db.{operation}` — query, insert

**Strands native OTel:** Strands 1.0+ agent ve tool span'lerini otomatik emit eder. Sadece TracerProvider setup yeterli.

### 17.2 structlog Config

```python
# backend/logging_setup.py
import logging
import structlog
from backend.config.settings import settings

def setup_logging():
    timestamper = structlog.processors.TimeStamper(fmt="iso")
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if settings.LOG_LEVEL == "DEBUG":
        processors.append(structlog.dev.ConsoleRenderer())
    else:
        processors.append(structlog.processors.JSONRenderer())
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.LOG_LEVEL.upper())
        ),
        cache_logger_on_first_use=True,
    )
```

**Default field listesi:**

```python
import structlog
logger = structlog.get_logger()
logger.info("tool_call",
    ticker="ASELS",
    agent_id="fundamental_worker_defense",
    tool_name="get_financials",
    call_id="abc-123",
    latency_ms=234,
    cache_hit=False,
    provider="isyatirim",
)
```

Çıktı (JSON):
```
{"event":"tool_call","level":"info","ts":"2026-05-13T10:23:45Z",
 "ticker":"ASELS","agent_id":"fundamental_worker_defense",
 "tool_name":"get_financials","call_id":"abc-123",
 "latency_ms":234,"cache_hit":false,"provider":"isyatirim"}
```

### 17.3 7 Metrik (`docs/testing.md §4.3`)

```python
# backend/metrics.py
from opentelemetry import metrics

meter = metrics.get_meter(__name__)

# 1. Pipeline süresi dağılımı
thesis_duration = meter.create_histogram(
    "thesis.generation_duration_seconds",
    description="End-to-end thesis pipeline duration",
)
# Label: mode (default/conservative)

# 2. Tool call success/fail counter
tool_call_total = meter.create_counter(
    "tool.call.count",
    description="Total tool invocations",
)
# Labels: tool, success (bool)

# 3. Citation soft-flag oranı
kaynaksiz_total = meter.create_counter(
    "citation.kaynaksiz_count",
    description="Total [KAYNAKSIZ] soft flags emitted",
)

# 4. Gemini token usage (cost tracking)
gemini_tokens = meter.create_counter(
    "gemini.tokens_used",
    description="Total tokens consumed",
)
# Labels: model (pro/flash), direction (input/output)

# 5. Provider fallback tracking
provider_fallback = meter.create_counter(
    "provider.fallback.count",
)
# Labels: domain, level (primary/secondary/fixture)

# 6. Kill-switch tetik sayısı
kill_switch_count = meter.create_counter(
    "kill_switch.trigger.count",
)
# Labels: reason (timeout/3fail/manual/rate_limit)

# 7. Cache hit rate
cache_hit_rate = meter.create_gauge(
    "cache.hit_rate",
)
# Labels: key_pattern
```

**Local development:** Console exporter (stdout JSON). Production v2: Prometheus scrape + Grafana.

### 17.4 Context Var Propagation

Orchestrator her agent geçişinde `current_agent_ctx`, `current_thesis_ctx` set'leyerek log + span'lere otomatik attribute ekler.

---

## 18. Deploy ve Local Dev

### 18.1 docker-compose.yml (tam)

```yaml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: thesisforge
      POSTGRES_USER: thesisforge
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/db_init.sql:/docker-entrypoint-initdb.d/01_init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thesisforge"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://thesisforge:dev@postgres:5432/thesisforge
      REDIS_URL: redis://redis:6379/0
      THESISFORGE_MODE: development
    env_file: .env
    ports: ["8000:8000"]
    depends_on:
      postgres: {condition: service_healthy}
      redis: {condition: service_healthy}
    command: >
      sh -c "alembic upgrade head &&
             uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload"

  frontend:
    build:
      context: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_WS_URL: ws://localhost:8000
    ports: ["3000:3000"]
    depends_on: [backend]

  jaeger:
    image: jaegertracing/all-in-one:latest
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    ports:
      - "16686:16686"   # UI
      - "4317:4317"     # OTLP gRPC

volumes:
  postgres_data:
```

### 18.2 Postgres Init Script

```sql
-- scripts/db_init.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid için
```

### 18.3 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY scripts ./scripts
COPY alembic.ini ./

EXPOSE 8000
CMD ["uvicorn", "backend.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 18.4 Production Deploy

| Bileşen | Servis | Free Tier |
|---|---|---|
| Backend | Railway (Dockerfile deploy) | Hobi plan |
| Frontend | Vercel (Next.js) | Hobby |
| PostgreSQL + pgvector | Supabase | 500MB |
| Redis | Upstash | Pay-per-request |

**Railway env vars:** `.env`'in tüm key'lerini Railway dashboard'undan tek tek ekle. `DATABASE_URL` Supabase'in pooled connection string'i.

**Migration komutu (Railway start command):**
```
alembic upgrade head && uvicorn backend.api.app:app --host 0.0.0.0 --port $PORT
```

### 18.5 `.env.example` (tam)

```bash
# AI
GOOGLE_API_KEY=
OPENAI_API_KEY=

# Veri (mevcut .env.probe ile aynı)
TCMB_EVDS_KEY=
MKK_API_KEY=
MKK_API_SECRET=

# Persistence
DATABASE_URL=postgresql+asyncpg://thesisforge:dev@localhost:5432/thesisforge
REDIS_URL=redis://localhost:6379/0

# App
SECRET_KEY=change-me-in-prod          # JWT için
THESISFORGE_MODE=development          # development | production | fixture | demo
LOG_LEVEL=INFO

# Observability (opsiyonel)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

---

## 19. Performans Bütçeleri

### 19.1 Concurrent Pipeline Limit

```python
# backend/services/concurrency.py
import asyncio
_pipeline_semaphore = asyncio.Semaphore(5)  # max 5 simultaneous

async def acquire_pipeline_slot():
    return await _pipeline_semaphore.acquire()
```

REST `/api/thesis` veya WS endpoint başında `acquire_pipeline_slot()`. Doluysa 429 dön (sliding window).

### 19.2 Süre Bütçesi

| Aşama | Hedef | Aşılırsa |
|---|---|---|
| Bundle async (§20) | <15s | log warn, devam |
| 3-bacak paralel | <2s | log warn |
| 2-Worker paralel | <20s | partial: tek worker'la devam |
| Devil's Advocate (Pro) | <10s | skip, critique=neutral |
| Synthesizer streaming (Pro) TTFT | <1s | log warn |
| Synthesizer toplam | <22s | timeout → kill-switch |
| Citation + persist | <4s | citation soft-pass, persist async |
| **Realistic toplam** | **<60s** | kill-switch 90s |
| **Pre-warm cache** | **<8s** | demo SLA |

### 19.3 Gemini Token Bütçesi (Per Agent)

| Agent | Input limit | Output limit | Toplam call |
|---|---|---|---|
| Macro Context | ~2k | ~512 | 1 |
| Sector Router LLM | ~200 | ~10 | 0-1 |
| Technical Worker | ~6k (bundle subset) | ~2k | 1 (4 tool çağrı içeride) |
| Fundamental Worker | ~10k | ~3k | 1 (6 tool çağrı içeride) |
| Devil's Advocate (Pro) | ~12k | ~2k | 1 |
| Synthesizer (Pro) | ~30k (bundle + worker + critique + memory) | ~6k | 1-2 (retry) |
| Memory base_rate | ~500 | ~200 | 1 |

**Gemini 2.5 Flash context:** 1M token. **Pro:** 2M token. Toplam pipeline ~80k token kullanır → bol marj.

### 19.4 Rate Limit Handler

```python
# backend/services/rate_limit.py
from datetime import datetime
import redis.asyncio as redis
from backend.config.settings import settings

_r = redis.from_url(settings.REDIS_URL, decode_responses=True)

PRO_RPM = 360
FLASH_RPM = 1000

async def check_gemini_quota(model: str = "flash") -> bool:
    minute = datetime.utcnow().strftime("%Y%m%d%H%M")
    key = f"ratelimit:gemini:{model}:{minute}"
    count = await _r.incr(key)
    if count == 1:
        await _r.expire(key, 70)
    limit = PRO_RPM if model == "pro" else FLASH_RPM
    return count <= limit
```

Strands Gemini exception → exponential backoff (1s, 2s, 4s). 3 başarısız → KillSwitchTriggered.

### 19.5 Bundle Size Limit

Synthesizer prompt'una tam bundle değil, `render_bundle_for_synthesizer()` (§10.1) ile özetlenmiş halini ver. Disclosures > 15 satır ise drop, news > 8 ise drop.

---

## 20. Async Bundle Optimization (KRİTİK)

**Problem:** `scripts/product/thesis_bundle.build_thesis_bundle` sync ve sıralı çağrılar → ~35s blocking. Pipeline budget (<60s realistic) için bu **çok fazla**.

**Çözüm:** 4 paralel grup, hedef 12-15s.

```python
# backend/services/bundle_async.py
import asyncio
from datetime import datetime, timezone
from scripts.product import (
    macro, prices, financials, disclosures, analyst, news, technicals, companies
)
import structlog
logger = structlog.get_logger()


async def build_thesis_bundle_async(ticker: str, days: int = 90) -> dict:
    bundle = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "errors": {},
        "_timings": {},
    }
    t0 = asyncio.get_event_loop().time()

    # 4 grup paralel
    grup_results = await asyncio.gather(
        _grup_macro_company(ticker, bundle),
        _grup_price_technical(ticker, days, bundle),
        _grup_fundamental(ticker, bundle),
        _grup_news(ticker, bundle),
        return_exceptions=True
    )

    for grup_name, exc in zip(
        ["macro_company", "price_technical", "fundamental", "news"], grup_results
    ):
        if isinstance(exc, Exception):
            bundle["errors"][grup_name] = str(exc)[:200]
            logger.error("bundle_group_fail", group=grup_name, error=str(exc)[:200])

    # Brent (opsiyonel, Energy squad için — fire-and-forget pattern olabilir)
    try:
        brent_df = await asyncio.to_thread(prices.get_brent_oil, 30)
        bundle["brent_oil_usd"] = round(float(brent_df.iloc[-1]["Close"]), 2)
    except Exception as e:
        bundle["errors"]["brent"] = str(e)[:120]

    bundle["_timings"]["total"] = round(asyncio.get_event_loop().time() - t0, 2)
    return bundle


async def _grup_macro_company(ticker: str, bundle: dict):
    t0 = asyncio.get_event_loop().time()
    macro_task = asyncio.to_thread(macro.get_macro_context)
    company_task = asyncio.to_thread(companies.get_company_by_ticker, ticker)
    macro_data, company_data = await asyncio.gather(macro_task, company_task)
    # TÜFE YoY ekle
    try:
        from backend.tools.data_tools import _compute_tufe_yoy
        macro_data["tufe_yoy_pct"] = await asyncio.to_thread(_compute_tufe_yoy)
    except Exception:
        macro_data["tufe_yoy_pct"] = None
    bundle["macro"] = macro_data
    bundle["company"] = company_data
    bundle["_timings"]["macro_company"] = round(asyncio.get_event_loop().time() - t0, 2)


async def _grup_price_technical(ticker: str, days: int, bundle: dict):
    t0 = asyncio.get_event_loop().time()
    ohlcv = await asyncio.to_thread(prices.get_ohlcv, ticker, days)
    last_c = float(ohlcv.iloc[-1]["Close"])
    first_c = float(ohlcv.iloc[0]["Close"])
    bundle["price"] = {
        "source": ohlcv.attrs.get("source"),
        "rows": len(ohlcv),
        "last_close": round(last_c, 2),
        "first_close": round(first_c, 2),
        "change_pct": round((last_c - first_c) / first_c * 100, 2),
        "last_date": str(ohlcv.index[-1].date()),
    }
    ind = await asyncio.to_thread(technicals.compute_indicators, ohlcv)
    bundle["technical"] = {**ind, "signal": technicals.technical_signal(ind)}
    bundle["_timings"]["price_technical"] = round(asyncio.get_event_loop().time() - t0, 2)


async def _grup_fundamental(ticker: str, bundle: dict):
    """financials + ratios + disclosures + analyst paralel."""
    t0 = asyncio.get_event_loop().time()

    async def _financials():
        try:
            return {"financials": await asyncio.to_thread(financials.get_latest_quarter, ticker),
                    "ratios": await asyncio.to_thread(financials.compute_basic_ratios, ticker)}
        except Exception as e:
            return {"_err": str(e)[:150]}

    async def _disclosures():
        try:
            d = await asyncio.to_thread(disclosures.get_company_disclosures, ticker, 30)
            return {"disclosures": [
                {"date": (x.get("publishDate") or x.get("date") or "")[:10],
                 "title": (x.get("title") or "")[:120]}
                for x in d[:15]
            ]}
        except Exception as e:
            return {"_err": str(e)[:150]}

    async def _analyst():
        try:
            return {"analyst": await asyncio.to_thread(analyst.get_recommendation, ticker) or {}}
        except Exception as e:
            return {"_err": str(e)[:150]}

    fin_r, disc_r, ana_r = await asyncio.gather(_financials(), _disclosures(), _analyst())
    for r, prefix in [(fin_r, "financials"), (disc_r, "disclosures"), (ana_r, "analyst")]:
        if "_err" in r:
            bundle["errors"][prefix] = r["_err"]
        else:
            bundle.update({k: v for k, v in r.items() if not k.startswith("_")})

    bundle["_timings"]["fundamental"] = round(asyncio.get_event_loop().time() - t0, 2)


# News rate-limit: global semaphore (1s aralık zorlamak yerine 2 concurrent allow)
_news_sem = asyncio.Semaphore(2)

async def _grup_news(ticker: str, bundle: dict):
    t0 = asyncio.get_event_loop().time()
    async with _news_sem:
        try:
            bundle["company_news"] = await asyncio.to_thread(
                news.get_company_news, ticker, 8, True, 30
            )
        except Exception as e:
            bundle["errors"]["company_news"] = str(e)[:150]
            bundle["company_news"] = []
    async with _news_sem:
        try:
            bundle["market_news"] = await asyncio.to_thread(news.get_market_news, 8)
        except Exception as e:
            bundle["errors"]["market_news"] = str(e)[:150]
            bundle["market_news"] = []
    bundle["_timings"]["news"] = round(asyncio.get_event_loop().time() - t0, 2)
```

**Beklenen süre:** 35s → ~14s (en yavaş grup news, ~10s; macro+company ~2s; price+tech ~3s; fundamental ~5s).

**Partial failure handling:** Tüm gruplardan `return_exceptions=True` ile gather → tek grup fail olsa pipeline devam eder, `bundle.errors` dolar. Synthesizer prompt'u eksik veriyi MISSING_FIELDS olarak yorumlar.

---

## C. Anatomi Düzeltmeleri (mevcut tablolarda dikkat)

### C.1 Pykap Field Adı Doğrulama

`disclosures.get_company_disclosures(ticker, days=30)` pykap kullanır. Field adları **runtime'da doğrulanmalı**:

```python
# scripts/test_pykap_schema.py (tek seferlik check)
import pykap
d = pykap.BISTCompany("THYAO").get_historical_disclosure_list(...)
print(d[0].keys())  # ['publishDate', 'title', ...] beklenir
```

Defensive lookup `disclosures_tool`'da §4.5 zaten yapılıyor (`d.get("publishDate") or d.get("date") or d.get("publishedAt")`).

### C.2 `analyst.get_recommendation` None Handling

borsapy bazen `None` döner — `recommendation_tool` `or {}` ile sarmalanmış (§4.5). Devil's Advocate prompt'u `None` recommendation görürse "analyst datası alınamadı" yorumla.

### C.3 News Rate-Limit Sürtüşmesi

`news.py:_MIN_INTERVAL=1.0` global blocking lock. **Agent branch'inde** `bundle_async._news_sem` ile 2 concurrent allow + async httpx kullan. Eğer scripts/product/news.py'ı bozmamak için aynen kalacaksa, `_grup_news` 1s × 8 haber = ~8s tahmin et (paralelleştirmek için product/news'ı async refactor gerekebilir; v2'ye atılabilir).

### C.4 Bundle.errors Synthesizer Pas Etme

Orchestrator (§6.6) Synthesizer prompt'una bundle TÜM'ünü pas eder. `render_bundle_for_synthesizer` (§10.1) sonunda **MISSING_FIELDS** notu var. Synthesizer prompt template (§6.3 KESİN KURALLAR §5) bunu işler.

### C.5 financial sayı string → float

`scripts/product/financials.py:get_latest_quarter` sayıları **string** döndürür. `financials_tool` (§4.5) `_to_float(v)` ile cast eder. Bundle.financials sonuçları float olur.

### C.6 TÜFE Ham → YoY

`scripts/product/macro.py:get_macro_context` `tufe_last` HAM endeks (10882.47). `macro_context_tool` (§4.5) `_compute_tufe_yoy()` ile YoY % ekler. Synthesizer'a yalnızca YoY pas et, ham endeks confuse eder.

### C.7 RuntimeError Tool Wrapper

`prices.get_ohlcv` her iki API fail ise `RuntimeError` atar. `logged_tool` exception path'inde tool_call_logs status="error" yazar, `register_tool_failure()` çağırır. Orchestrator partial bundle ile devam eder.

### C.8 ThYAO yfinance 50 minimum bar

`compute_indicators` Bollinger length=20, SMA50 ister. yfinance 50+ bar lazım. `get_ohlcv(days=90)` yeterli ama daha az gün isteniyorsa indicators kısmı `None` döner — `technicals.py:_last` zaten None handler.

### C.9 pgvector ivfflat Lists

`ivfflat (... WITH (lists = 100))` — <100k tez için yeterli. Hackathon scope (<1000 tez) ihmal edilebilir; default lists=100.

### C.10 Eksik Technical Helper'lar

`agents.md §2.4`'te istenen `detect_patterns`, `find_support_resistance`, `relative_strength` `scripts/product/technicals.py`'da YOK. Agent branch'inde `backend/services/technicals_extra.py`'da yaz:

```python
import pandas as pd
import pandas_ta as ta

def find_support_resistance(ohlcv: pd.DataFrame, lookback: int = 30) -> dict:
    """Son N barda en az 2 kez test edilmiş seviyeler."""
    recent = ohlcv.tail(lookback)
    pivots = ta.pivot(high=recent["High"], low=recent["Low"], close=recent["Close"])
    return {
        "support": sorted(set(round(p, 2) for p in pivots["pivot_s1"].dropna().tail(3))),
        "resistance": sorted(set(round(p, 2) for p in pivots["pivot_r1"].dropna().tail(3))),
    }

def relative_strength(stock_ohlcv: pd.DataFrame,
                       index_ohlcv: pd.DataFrame, days: int = 30) -> float:
    """Hisse vs endeks getiri farkı, % puan."""
    stock_ret = (stock_ohlcv.iloc[-1]["Close"] - stock_ohlcv.iloc[-days]["Close"]) / stock_ohlcv.iloc[-days]["Close"]
    idx_ret = (index_ohlcv.iloc[-1]["Close"] - index_ohlcv.iloc[-days]["Close"]) / index_ohlcv.iloc[-days]["Close"]
    return round((stock_ret - idx_ret) * 100, 2)

def detect_patterns(ohlcv: pd.DataFrame) -> list[str]:
    """pandas-ta candlestick patterns."""
    cdl = ta.cdl_pattern(open_=ohlcv["Open"], high=ohlcv["High"],
                          low=ohlcv["Low"], close=ohlcv["Close"], name="all")
    if cdl is None or cdl.empty:
        return []
    last_row = cdl.iloc[-1]
    return [col.replace("CDL_", "") for col, v in last_row.items() if v != 0][:5]
```

Bu helper'lar Technical Worker tool listesine eklenir.

---

## 21. Hızlı Referans Tabloları

### 21.1 Tool → Agent → Bundle Field

| Tool | Çağıran Agent | Bundle Field |
|---|---|---|
| `get_macro_context` | Macro Context | `macro` |
| `get_market_news` | Macro Context, Synthesizer | `market_news` |
| `get_company` | Orchestrator, Sector Router | `company` |
| `get_ohlcv` | Technical Worker | `price` |
| `compute_indicators` | Technical Worker | `technical` |
| `get_index` | Technical Worker | inline (relative_strength) |
| `get_financials` | Fundamental Worker | `financials` |
| `compute_ratios` | Fundamental Worker | `ratios` |
| `get_disclosures` | Fundamental Worker | `disclosures` |
| `get_recommendation` | Fundamental Worker | `analyst` |
| `get_company_news` | Fundamental, Synthesizer | `company_news` |
| `get_dividends` | Fundamental (Conservative) | inline |
| `get_brent_oil` | Fundamental (Energy) | `brent_oil_usd` |
| `search_sector_keyword` | Fundamental (peer) | inline |
| `lookup_sector` | Sector Router | inline |
| `memory_search` | Orchestrator → Memory | `memory_hits` |
| `memory_base_rate` | Devil's Advocate | inline |
| `memory_write` | Orchestrator (async, post-thesis) | DB |

### 21.2 Çevre Değişkenleri (zorunlu)

```
GOOGLE_API_KEY=...
OPENAI_API_KEY=...
TCMB_EVDS_KEY=...
MKK_API_KEY=...
MKK_API_SECRET=...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
SECRET_KEY=...
THESISFORGE_MODE=development
LOG_LEVEL=INFO
OTEL_EXPORTER_OTLP_ENDPOINT=  # opsiyonel
```

### 21.3 Çalıştırma Sırası — Sprint Planı (`docs/sprint.md` ile uyumlu)

Bu liste **sırayla** uygulanmalı, Sprint günlerine §13'te map'lendi:

1. **Repo iskeleti** — `backend/{agents,api,db,schemas,tools,services,utils,jobs,config,tests}/`, `requirements.txt`, `pyproject.toml`, `alembic.ini`, `.env.example`
2. **DB modelleri + Alembic migration** — `backend/db/models.py` (§8.3), `alembic init` + ilk migration, `backend/db/session.py`
3. **Logged tool + cache wrapper + data_tools.py** — §4.1-4.5 (12 tool)
4. **Pydantic schemas** — `backend/schemas/{citations,macro,technical,fundamental,critique,synthesis,sector}.py` (§5.1)
5. **Async bundle** — `backend/services/bundle_async.py` (§20). End-to-end test: <15s.
6. **Strands + GeminiModel + tek ajan hello-world** — `backend/agents/_models.py` + `macro_context.py` (§6.2). Standalone test.
7. **6 ajan tek tek** — Sector Router, Technical Worker, Fundamental Worker factory, Devil's, Synthesizer (streaming), Memory.
8. **DataProvider Registry** — `backend/services/providers/` (§7.5).
9. **Fixture sistem** — `backend/services/fixture_store.py` (§8.4) + `scripts/warmup.py`.
10. **Citation Validator** — `backend/agents/citation_validator.py` (§7.1). Test: sahte UUID → soft flag.
11. **Format Normalizer + Confidence** — `backend/utils/format.py` (§10) + `backend/services/confidence.py` (§9).
12. **Orchestrator + pipeline** — `backend/agents/orchestrator.py` (§6.6). E2E test: `run_thesis_pipeline("THYAO")`.
13. **FastAPI + WebSocket + REST** — `backend/api/{app,ws,rest,auth}.py` (§11, §16).
14. **Conservative mode** — Synthesizer prompt conditional (§6.3, §6.7).
15. **APScheduler cron** — `backend/jobs/memory_outcome_update.py` (§8.2.1).
16. **Kill-switch** — `backend/services/killswitch.py` (§12) + pre-warm fixture'lar.
17. **Observability** — `backend/observability.py` + `logging_setup.py` (§17).
18. **Docker compose + CI** — `docker-compose.yml` (§18) + `.github/workflows/ci.yml` (§14.6).
19. **Smoke + integration testler** — `backend/tests/` (§14).
20. **Deploy** — Railway + Vercel + Supabase + Upstash (§18.4).

---

## 22. Bu Spec'i AI Asistana Verirken

**Yapması gereken:** "§21.3 Çalıştırma Sırası" listesini sırayla uygula. Her adımdan sonra ilgili testleri yaz (§14).

**Yapmaması gereken:**
- v2 ajanları (Sentiment Worker, Backtest Validator) implemente etmek — sadece 8 ajan.
- Frontend (Next.js) — bu spec yalnız backend.
- Yeni veri kaynağı eklemek — mevcut 7 kaynak yeterli.
- `scripts/product/*` modüllerini değiştirmek — yalnızca dışından sarmala.
- Strands SDK'nın §0.1'deki düzeltilmiş API'sini bypass etmek.

**Çelişki halinde öncelik sırası:**
1. `docs/agents.md`, `docs/architecture.md`, `docs/flows.md`, `docs/data.md`, `docs/database.md` (truth file'lar)
2. Bu spec (`AGENT_BUILD_SPEC.md`)
3. `docs/testing.md`, `docs/stack.md`, `docs/sprint.md` (yardımcı truth file'lar)
4. `scripts/DATA_LAYER.md` (veri katmanı durum raporu)
5. `BLUEPRINT.md` (özet — yukarıdakilerle çelişirse yukarıdakiler kazanır)

**Doğrulama listesi (AI implementasyon bittikten sonra koşacak):**

- [ ] `pip install -e .` ve `pip check` temiz
- [ ] `alembic upgrade head` migration'lar başarılı
- [ ] `python -m backend.agents.macro_context` (standalone test) → MacroContext döner
- [ ] `pytest -m unit` tüm unit testler geçer, coverage >%70
- [ ] `pytest -m integration` mock LLM ile pipeline e2e geçer
- [ ] `docker compose up` → tüm servis healthy
- [ ] `curl http://localhost:8000/health` → 200 OK
- [ ] `wscat -c ws://localhost:8000/ws/thesis/test` + `{"ticker":"ASELS"}` → token stream
- [ ] 10 pre-warm hisse için `scripts/warmup.py` çalışır
- [ ] Kill-switch test: 90s timeout veya `?force_demo=1` → fixture serve
- [ ] Citation soft-flag: kasıtlı sahte UUID → `[KAYNAKSIZ]` annotation

---

## 23. Disclaimer

ThesisForge bilgi sunumu ve eğitim aracıdır. **Yatırım tavsiyesi değildir** (SPK lisansı dışı). Synthesizer prompt'u her tezde zorunlu disclaimer üretir. Frontend her tez sayfasında footer'da disclaimer gösterir.


