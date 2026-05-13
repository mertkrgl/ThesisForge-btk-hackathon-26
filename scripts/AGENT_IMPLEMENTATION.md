# spike/data-probe → Üretim: Strands Agent Tabanlı Implementasyon Raporu

## Context

`spike/data-probe` branch'inde **9 dış veri kaynağına** (TCMB EVDS, MKK API, yfinance, isyatirim, borsapy, pykap, KAP RSS, Google News, Brent Oil) probe testleri yapıldı (`scripts/test/`) ve doğrulanan kaynakların **çağrı/normalizasyon/fallback** sarmalayıcıları `scripts/product/` altına yazıldı (`macro, prices, financials, disclosures, technicals, analyst, news, companies, thesis_bundle`).

Bu rapor, mevcut `scripts/product/*` katmanını **kalıcı bir backend paketine** taşıyıp **Strands Agent** çerçevesinde 8 ajanlık komite (BLUEPRINT.md + docs/agents.md) ile koşturmanın **tam yol haritasını** verir: dizin yapısı, her API'nin gerçek koşumda nasıl çağrılacağı, her ajanın hangi tool'u nasıl çağıracağı, paralelizasyon, hata/fallback/cache, citation kaydı ve doğrulama; .env, secret, deploy ve test.

> Bu plan **frontend** branch'inde yazılıyor ama hedef değişiklik **monorepo köküne `backend/`** açılıp ürünleştirme. Frontend dosyalarına dokunulmayacak.

---

## 1. Mevcut Durum — Net Tespit

### 1.1 `scripts/product/` (kaynaklar ve gerçek çağrı yüzeyi)

| Modül | Fonksiyon | Dış kaynak | Auth | Geri dönüş |
|---|---|---|---|---|
| `macro.py` | `get_macro_context()`, `get_series(code,start,end)` | TCMB EVDS `https://evds3.tcmb.gov.tr/igmevdsms-dis` | Header `key: $TCMB_EVDS_KEY` | `{usd_try, eur_try, tufe_last, policy_rate, as_of}` |
| `companies.py` | `get_all_members()`, `get_bist_companies()`, `get_company_by_ticker(t)`, `get_funds()` | MKK API `https://apigwdev.mkk.com.tr/api/vyk/...` | Basic Auth (`MKK_API_KEY:MKK_API_SECRET`) | DataFrame / dict |
| `prices.py` | `get_ohlcv(t,days)`, `get_index()`, `get_dividends(t)`, `get_brent_oil()` | yfinance (primary) → isyatirim (fallback) | yok | DataFrame (`.attrs["source"]`) |
| `financials.py` | `get_financials(t,years,group)`, `get_latest_quarter(t)`, `compute_basic_ratios(t)` | isyatirimhisse (XI_29 / UFRS / UFRS_K) | yok | DataFrame / dict (TR sütun adları) |
| `disclosures.py` | MKK: `get_last_disclosure_id`, `get_disclosure_detail`, `get_latest_disclosures`; pykap: `get_company_disclosures(t,days)` | MKK API → pykap (KAP.org.tr) | MKK Basic Auth / pykap auth'suz | list[dict] |
| `technicals.py` | `compute_indicators(ohlcv)`, `technical_signal(ind)` | pandas-ta (lokal) | — | dict |
| `analyst.py` | `get_recommendation(t)`, `get_quick_info(t)`, `search_sector(k)`, `get_fx_rate(c)` | borsapy | yok (≤1 req/s) | dict |
| `news.py` | `get_company_news(t,...)`, `get_market_news()`, `get_news_detail(url)` | Google News RSS + gnewsdecoder + BS4 | yok (≤1 req/s) | list[dict] |
| `thesis_bundle.py` | `build_thesis_bundle(t,days=90)` | tüm yukarıdakileri sıralı çağırır | — | dev bundle dict |

### 1.2 `scripts/test/probe_*.py`

`run_all.py` 7 prob'u koşturuyor, `.env.probe`'tan key yüklüyor, Rich tablosuyla OK/PARTIAL/FAIL raporluyor. Bunlar **regression smoke test** olarak `backend/tests/integration/` altına taşınacak.

### 1.3 Eksikler

- Asenkron değil (httpx blocking `.get`, yfinance/isyatirim/borsapy senkron). Strands `asyncio.gather` ile paralel koşum için **executor sarmalayıcı** gerekli.
- Cache yok (Redis/disk).
- Citation/`call_id` yok (tool log üretmiyor).
- Schema validation yok (Pydantic).
- Fixture mode yok.
- Rate-limit korunması parça parça (`news.py` global `_LAST_REQUEST_TS`, `analyst/prices` yok).

---

## 2. Hedef Mimari — `backend/` Paketi

```
backend/
├── pyproject.toml
├── .env.example
├── alembic/                    # migrations
├── app/
│   ├── main.py                 # FastAPI app + lifespan (Redis, DB, Strands runtime)
│   ├── api/
│   │   ├── chat.py             # POST /chat → session + tetik
│   │   ├── thesis_ws.py        # WS /ws/thesis/{session_id}
│   │   ├── thesis_rest.py      # GET /api/thesis/{id}, /status
│   │   └── watchlist.py
│   ├── core/
│   │   ├── config.py           # pydantic-settings: tüm env vars
│   │   ├── logging.py          # structlog + OpenTelemetry
│   │   └── redis.py            # async redis client + pub/sub
│   ├── data/
│   │   ├── providers/          # ⇐ scripts/product/* buraya taşınır
│   │   │   ├── base.py         # DataProvider Protocol + decorators
│   │   │   ├── macro.py        # TCMB (async, httpx.AsyncClient)
│   │   │   ├── prices.py       # yfinance/isyatirim async-wrapped
│   │   │   ├── financials.py
│   │   │   ├── disclosures.py  # MKK async + pykap fallback
│   │   │   ├── technicals.py
│   │   │   ├── analyst.py      # borsapy async-wrapped
│   │   │   ├── news.py         # async httpx + BS4
│   │   │   └── companies.py
│   │   ├── cache.py            # Redis TTL'li cache helper
│   │   ├── ratelimit.py        # per-source aiolimiter
│   │   ├── fixture.py          # disk fallback fixtures/<source>/<key>.json
│   │   └── registry.py         # fetch(source, key) → primary→secondary→fixture
│   ├── agents/
│   │   ├── runtime.py          # Strands runtime + model registry (Gemini Pro/Flash)
│   │   ├── tools.py            # @tool dekoratörleri — provider'ları sarar, call_id üretir, log atar
│   │   ├── schemas.py          # Pydantic structured outputs
│   │   ├── prompts/            # her ajan için system prompt md
│   │   ├── macro_context.py
│   │   ├── sector_router.py
│   │   ├── technical_worker.py
│   │   ├── fundamental_worker.py
│   │   ├── devils_advocate.py
│   │   ├── synthesizer.py
│   │   ├── memory.py
│   │   └── orchestrator.py     # tüm grafiği yürüten coroutine
│   ├── db/
│   │   ├── models.py           # SQLAlchemy: users, theses, tool_call_logs, citations, thesis_embeddings
│   │   ├── session.py
│   │   └── repo.py
│   └── citations/
│       ├── validator.py        # [kaynak:<call_id>] regex + log tablosuna ID-bazlı match
│       └── numbers.py          # sayısal sanity check
└── tests/
    ├── unit/
    └── integration/            # scripts/test/probe_* migrate
```

**Taşıma kuralı:** `scripts/product/*` dosyaları **olduğu gibi kopyalanmaz**; her modül `app/data/providers/` altına şu üç değişiklikle alınır:
1. `httpx.Client` → `httpx.AsyncClient` (modül seviyesinde singleton, `app.main.lifespan` ile aç/kapat).
2. yfinance/isyatirim/borsapy/pykap senkron — `asyncio.to_thread(func, *args)` ile sarılır.
3. Fonksiyon imzasının başına `@cached(domain, ttl)` ve `@ratelimited(source)` dekoratörleri.

---

## 3. Veri Katmanı — Adım Adım Implementasyon

### 3.1 Config (`app/core/config.py`)

`pydantic-settings.BaseSettings` ile tüm env vars:

```python
class Settings(BaseSettings):
    THESISFORGE_MODE: Literal["production","fixture","demo"] = "production"
    TCMB_EVDS_KEY: str
    MKK_API_KEY: str
    MKK_API_SECRET: str
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str
    DATABASE_URL: str
    REDIS_URL: str
    TCMB_BASE: str = "https://evds3.tcmb.gov.tr/igmevdsms-dis"
    MKK_BASE: str = "https://apigwdev.mkk.com.tr"
    HTTP_TIMEOUT: float = 15.0
    USER_AGENT: str = "ThesisForge/0.1"
    model_config = SettingsConfigDict(env_file=".env")
```

`.env.example` `docs/stack.md §7` ile aynı; mevcut `.env.probe` değerleri buraya migrate edilir.

### 3.2 HTTP istemcileri & Lifespan

```python
# app/main.py
@asynccontextmanager
async def lifespan(app):
    app.state.http = httpx.AsyncClient(
        timeout=settings.HTTP_TIMEOUT,
        headers={"User-Agent": settings.USER_AGENT},
    )
    app.state.redis = await redis.from_url(settings.REDIS_URL)
    app.state.strands = build_strands_runtime()   # §4
    yield
    await app.state.http.aclose()
    await app.state.redis.aclose()
```

`httpx.AsyncClient` **tek instance** — TCMB ve MKK aynı havuzu paylaşır (`base_url` per-request).

### 3.3 Rate limit & cache dekoratörleri

```python
# app/data/ratelimit.py
LIMITS = {
  "isyatirim": AsyncLimiter(1, 1.0),
  "borsapy":   AsyncLimiter(1, 1.0),
  "news":      AsyncLimiter(1, 1.0),
  "tcmb":      AsyncLimiter(60, 60.0),
  "mkk":       AsyncLimiter(10, 1.0),
  "yfinance":  AsyncLimiter(5, 1.0),
}
def ratelimited(source): ...
```

```python
# app/data/cache.py
TTL = {
  "macro": 900,         # 15 dk
  "ohlcv": 900,
  "financials": 86400,  # 24 sa
  "kap": 3600,          # 1 sa
  "analyst": 1800,
  "news": 900,
  "brent": 1800,
}
def cached(domain, key_fn, ttl=None): ...   # Redis GET → call → SETEX
```

Anahtar şeması: `tf:{domain}:{ticker_or_param}:{hash(args)}`.

### 3.4 Provider modülleri — somut değişiklikler

**`macro.py` (TCMB)** — `scripts/product/macro.py` aynısı, sadece:
```python
@ratelimited("tcmb")
@cached("macro", lambda: "context", ttl=900)
async def get_macro_context() -> MacroContext: ...
```
İçeride `app.state.http.get(f"{settings.TCMB_BASE}/series-...", headers={"key": settings.TCMB_EVDS_KEY}, params=...)`. `MacroContext` Pydantic modeli (§4.4).

**`prices.py`** — yfinance senkron olduğundan:
```python
async def get_ohlcv(ticker: str, days=90) -> pd.DataFrame:
    async with LIMITS["yfinance"]:
        try:
            df = await asyncio.to_thread(_yf_history, ticker, days)
            df.attrs["source"] = "yfinance"; return df
        except Exception:
            async with LIMITS["isyatirim"]:
                df = await asyncio.to_thread(_isy_history, ticker, days)
                df.attrs["source"] = "isyatirim"; return df
```
`get_brent_oil()` aynı kalıp (`BZ=F`). `get_dividends()` yfinance.

**`financials.py`** — `isyatirimhisse.fetch_financials` `to_thread`. TR sütun adları için **`compute_basic_ratios`** mevcut helper kullanılır; ek olarak `app/agents/schemas.py:LatestQuarter` Pydantic modeline normalize.

**`disclosures.py`** — MKK için **persistent `httpx.AsyncClient`** (mevcut kod sync httpx.Client kullanıyor; async'e çevrilecek). pykap fallback `to_thread`.

**`analyst.py`** — borsapy `to_thread` + `LIMITS["borsapy"]`.

**`news.py`** — mevcut global `_LAST_REQUEST_TS` kalktı, `LIMITS["news"]` kullanılır. `googlenewsdecoder` senkron → `to_thread`. BS4 parse zaten lokal.

**`technicals.py`** — saf hesap, async wrapper'a gerek yok (CPU-bound; `to_thread` opsiyonel).

**`companies.py`** — MKK members listesi **uygulama başlangıcında bir kez** çağrılır, Redis'te 24 saat tutulur (`tf:companies:bist` anahtarı). Sektör router ve ticker validate sıcak okur.

### 3.5 Fixture & demo mode

`app/data/fixture.py`:
- `fixtures/<source>/<key>.json` disk store.
- `THESISFORGE_MODE=fixture` → tüm provider'lar primary/secondary çağırmadan diskten okur.
- `demo` modu = primary cache miss varsa fixture'a düşer (kill-switch).

Üretim modunda her başarılı primary çağrı **arka planda** `fixtures/`'a 48 saat snapshot yazar (rolling).

### 3.6 Registry & `fetch(source,key)`

```python
async def fetch(source: str, key: str, *, ctx: ToolCtx) -> dict:
    """call_id üret, tool_call_logs'a yaz, cache→primary→secondary→fixture sırasıyla dener."""
```
**Her** veri çağrısı buradan geçer — agent'lar `tool_call_logs.call_id` döndürür (citation için kritik, `docs/agents.md §4`).

---

## 4. Strands Agent Katmanı

### 4.1 Runtime kurulumu (`app/agents/runtime.py`)

```python
from strands import Agent, tool
from strands.models.gemini import Gemini

GEMINI_PRO   = Gemini(model="gemini-2.5-pro",   api_key=settings.GEMINI_API_KEY)
GEMINI_FLASH = Gemini(model="gemini-2.5-flash", api_key=settings.GEMINI_API_KEY)

def build_strands_runtime() -> "Runtime":
    return Runtime(
        macro_context     = build_macro_context_agent(),
        sector_router     = build_sector_router_agent(),
        technical_worker  = build_technical_worker(),
        fundamental_worker= build_fundamental_worker(),
        devils_advocate   = build_devils_advocate(),
        synthesizer       = build_synthesizer(),
        memory            = build_memory_agent(),
    )
```

### 4.2 Tool tanımları (`app/agents/tools.py`)

Her tool `@tool` dekoratörüyle Strands'a açılır, **provider'ı sarar, `call_id` üretir, `tool_call_logs`'a yazar**:

```python
@tool(description="TCMB makro göstergeleri (USD/TRY, EUR/TRY, TÜFE, faiz).")
async def get_tcmb_indicators(ctx: ToolCtx) -> dict:
    return await fetch("macro", "context", ctx=ctx)

@tool
async def get_ohlcv(ticker: str, period_days: int = 90, *, ctx: ToolCtx) -> dict: ...
@tool
async def calculate_indicators(ohlcv: dict, *, ctx: ToolCtx) -> dict: ...
@tool
async def fetch_kap_filings(ticker: str, days: int = 30, *, ctx: ToolCtx) -> list[dict]: ...
@tool
async def get_financial_statements(ticker: str, *, ctx: ToolCtx) -> dict: ...
@tool
async def compute_ratios(financials: dict, squad: str, *, ctx: ToolCtx) -> dict: ...
@tool
async def get_recommendation(ticker: str, *, ctx: ToolCtx) -> dict: ...
@tool
async def get_company_news(ticker: str, count: int = 10, *, ctx: ToolCtx) -> list[dict]: ...
@tool
async def get_brent_oil(days: int = 30, *, ctx: ToolCtx) -> dict: ...
@tool
async def memory_search(query: str, ticker: str, top_k: int = 3, *, ctx: ToolCtx) -> list[dict]: ...
@tool
async def memory_write(thesis_id: str, embedding_text: str, *, ctx: ToolCtx) -> None: ...
@tool
async def validate_ticker(ticker: str, *, ctx: ToolCtx) -> dict: ...
@tool
async def lookup_sector(ticker: str, *, ctx: ToolCtx) -> str: ...
```

`ToolCtx` Strands tarafından enjekte edilir; içinde `session_id, agent_id, http, redis, db` taşınır.

### 4.3 Ajan tanımları — model + tool seti + system prompt

| Ajan | Model | Tool'lar | Max tool call | Output |
|---|---|---|---|---|
| Macro Context | Flash | `get_tcmb_indicators`, `get_company_news("BIST")`, `get_brent_oil` | 3 | `MacroContext` (Pydantic) |
| Sector Router | Flash | `lookup_sector` | 1 | `{ticker, squad}` |
| Technical Worker | Flash | `get_ohlcv`, `calculate_indicators`, `find_support_resistance`, `relative_strength` | 5 | `TechnicalAnalysis` |
| Fundamental Worker | Flash | `fetch_kap_filings`, `get_financial_statements`, `compute_ratios`, `get_recommendation`, `get_dividend_history` | 6 | `FundamentalAnalysis` |
| Devil's Advocate | **Pro** | `query_workers`, `find_disconfirming_evidence`, `base_rate_check` | 4 | `Critique` |
| Synthesizer | **Pro** | (yok — sadece input alır, streaming Markdown üretir) | 0 | streaming text |
| Memory Agent | Flash + `text-embedding-3-large` | `memory_search`, `memory_write` | 2 | list[hit] |
| Orchestrator | Flash | `validate_ticker`, agent-as-tool: `run_macro`, `run_sector`, `run_workers`, `run_devil`, `run_synth`, `run_memory` | — | session lifecycle |

System prompt'lar `app/agents/prompts/*.md` — `docs/agents.md` §2.1–2.8 metinleri buraya kopya. Squad-spesifik metrikler (Banking → NIM/NPL/CASA; Energy → refining margin/Brent; vd.) fundamental worker prompt'una **sektör koşullu** enjekte edilir.

### 4.4 Structured outputs (`app/agents/schemas.py`)

`docs/agents.md` §2.4–2.7'deki şemalar **birebir** kodlanır:

```python
class Citation(BaseModel):
    call_id: UUID
    tool_name: str
    quote: str | None = None

class Observation(BaseModel):
    text: str
    citation: Citation
    confidence: int  # 0-100

class TechnicalAnalysis(BaseModel):
    trend_short: Literal["bullish","bearish","neutral"]
    trend_long:  Literal["bullish","bearish","neutral"]
    key_levels: dict
    momentum_score: int
    patterns_detected: list[str]
    notable_observations: list[Observation]
    citations: list[Citation]

class FundamentalAnalysis(BaseModel):
    squad: Literal["Banking","Energy","Defense","Retail","RealEstate","Generic"]
    ratios: dict
    peer_compare: list[dict]
    kap_highlights: list[Observation]
    notable_observations: list[Observation]
    citations: list[Citation]

class Critique(BaseModel):
    technical_pushback: list[str]
    fundamental_pushback: list[str]
    cross_cutting_risks: list[str]
    base_rate_warnings: list[str]
    overall_critique_strength: int

class MacroContext(BaseModel):
    paragraph: str
    usd_try: float | None
    eur_try: float | None
    tufe_last: float | None
    policy_rate: float | None
    as_of: date
    citations: list[Citation]
```

Strands `agent.run(..., output_schema=TechnicalAnalysis)` ile **JSON-mode** zorlanır.

### 4.5 Orchestrator (`app/agents/orchestrator.py`)

`docs/architecture.md §2` execution model birebir:

```python
async def run_thesis(session_id: str, ticker: str, user_mode: str, ws_emit):
    rt = app.state.strands
    ctx = ToolCtx(session_id=session_id, ...)

    # 1) Validate
    info = await tools.validate_ticker(ticker, ctx=ctx)

    # 2) 3-bacak paralel
    macro, squad, mem_hits = await asyncio.gather(
        rt.macro_context.run("Güncel makro paragraf üret.", ctx=ctx, output_schema=MacroContext),
        rt.sector_router.run(ticker, ctx=ctx),
        rt.memory.run(f"benzer tez: {ticker}", ctx=ctx),
    )

    # 3) 2 Worker paralel — squad prompt enjekte
    tech, fund = await asyncio.gather(
        rt.technical_worker.run(ticker, ctx=ctx, output_schema=TechnicalAnalysis),
        rt.fundamental_worker.run(ticker, squad=squad.squad, ctx=ctx,
                                  output_schema=FundamentalAnalysis),
    )

    # 4) Devil (sequential)
    critique = await rt.devils_advocate.run(
        inputs={"tech": tech, "fund": fund},
        ctx=ctx, output_schema=Critique,
    )

    # 5) Synthesizer (streaming)
    async for tok in rt.synthesizer.stream(
        inputs={"macro": macro, "tech": tech, "fund": fund,
                "critique": critique, "memory": mem_hits, "user_mode": user_mode},
    ):
        await ws_emit(tok)

    # 6) Citation validation (1 retry, soft flag)
    ok = await validate_citations(thesis_md, ctx.call_log)
    if not ok:
        thesis_md = await rt.synthesizer.repair(thesis_md)   # 1 retry
        thesis_md = mark_unsourced(thesis_md)                # [KAYNAKSIZ]

    # 7) Persist + memory async
    thesis_id = await db.save_thesis(...)
    asyncio.create_task(rt.memory.write(thesis_id, thesis_md, ctx=ctx))
```

### 4.6 Citation validator (`app/citations/`)

- `validator.py`: Synthesizer çıktısındaki `[kaynak: <uuid>]` etiketlerini regex'le yakala; her UUID `tool_call_logs.call_id`'de var mı kontrol et (ID-bazlı, deterministik).
- `numbers.py`: Tüm sayıları `\d[\d.,]*` ile yakala; her sayının ya çevresindeki citation tool result'unda ya da `MacroContext.usd_try/...` gibi typed alanda olduğunu doğrula.
- Başarısız → 1 retry → hâlâ başarısız → `[KAYNAKSIZ]` flag (soft pass).

### 4.7 Memory Agent

- **Write:** `text-embedding-3-large` (OpenAI) → 3072-dim → `thesis_embeddings` (pgvector). Asenkron task.
- **Read:** yeni sorgu embed → `SELECT ... ORDER BY embedding <-> $1 LIMIT 3 WHERE ticker=$2 OR sector=$3`.
- **Nightly cron (02:00 UTC):** APScheduler — `outcome='pending' AND thesis_date<=now()-7d` olan tezler için yfinance fiyat çek, `actual_return` hesapla, satır güncelle.

---

## 5. Persistence

`docs/database.md`'deki şema. SQLAlchemy + Alembic. Kritik tablolar:

- `users(id, email, mode)`
- `theses(id, user_id, ticker, squad, content_md, confidence, outcome, actual_return, thesis_date)`
- `tool_call_logs(call_id PK uuid, session_id, agent_id, tool_name, args jsonb, result jsonb, ts, latency_ms)`
- `citations(thesis_id, call_id FK, claim_text)`
- `thesis_embeddings(thesis_id PK, embedding vector(3072))`
- `watchlist(user_id, ticker)`

Migration `alembic init alembic`; ilk revision tüm tablolar + `CREATE EXTENSION vector`.

---

## 6. API Yüzeyi (FastAPI)

| Endpoint | Tip | İş |
|---|---|---|
| `POST /api/chat` | REST | session aç, `run_thesis` arka plan task'ı tetikle, `session_id` döner |
| `WS /ws/thesis/{session_id}` | WebSocket | synthesizer token stream + ara agent statüleri |
| `GET /api/thesis/{id}/status` | REST | son token offset'inden sonrası (REST polling degrade) |
| `GET /api/thesis/{id}` | REST | tam tez + citations |
| `GET /api/macro` | REST | macro context (15 dk cache) |
| `GET/POST/DELETE /api/watchlist` | REST | CRUD |

Frontend (`/Users/melihgenel/Desktop/btk-hackathon-26/frontend`) henüz boş — bu plan sadece backend; frontend ayrı bir görevde.

---

## 7. Çağrı Bütçesi — Tek Tez (Cache Miss)

| Adım | Çağrı | Süre tahmini |
|---|---|---|
| `validate_ticker` (MKK members cache) | 0 net (sıcak) | <50 ms |
| Macro (TCMB 4 seri) | 1 | 1-2 s |
| Sector Router | 0 net (lookup) | <100 ms |
| Memory similarity | 1 (embed) + 1 (pgvector) | <500 ms |
| Technical: OHLCV + indicators | 1 (yfinance) + 0 (lokal) | 2-4 s |
| Fundamental: KAP + financials + ratios + analyst + peers | 4-5 | 8-15 s |
| News (şirket + market) | 2 | 2-3 s |
| Devil's Advocate (Pro, no tool) | 0 net | 5-10 s |
| Synthesizer (Pro, streaming) | 0 net | 15-25 s |
| **Toplam** | **~10 HTTP, 2 LLM Pro, 4 LLM Flash** | **40-60 s** |

Pre-warmed cache (macro + companies + son tez memory hit) → **<8 s** demo modu.

---

## 8. Hata, Fallback, Rate-limit Politikası

| Senaryo | Davranış |
|---|---|
| TCMB 429/5xx | 2 retry expo backoff → fixture |
| MKK auth red | pykap fallback → fixture; UI'da banner "KAP gecikmeli" |
| isyatirim ban riski | global `AsyncLimiter(1, 1.0)`, 5xx'te 30 sn devre kesici |
| yfinance bozulursa | otomatik isyatirim fallback (mevcut kod) |
| borsapy boş döner | analyst alanı `null`, confidence skor `data quality` bileşeninde ceza |
| Google News 0 sonuç | boş liste; haber bölümü Synthesizer prompt'undan çıkar |
| Pydantic validation fail | provider 1 retry → fixture |
| Citation eksik | 1 retry → `[KAYNAKSIZ]` soft flag |

---

## 9. Gözlemlenebilirlik

- `structlog` JSON log; her `tool_call` → `{call_id, agent, tool, latency_ms, cache_hit, source_chain}`.
- OpenTelemetry → Strands native; FastAPI + httpx instrumentation.
- `/metrics` Prometheus (opsiyonel): cache hit %, primary success %, p50/p95 latency.

---

## 10. Test Stratejisi

| Katman | Test |
|---|---|
| Unit | her provider için response fixture'larıyla mock test; `compute_basic_ratios`, `compute_indicators` deterministik |
| Integration | `tests/integration/test_probes.py` ← `scripts/test/probe_*` migrate; CI'da `THESISFORGE_MODE=fixture` ile koşar, gece nightly job production modda |
| Agent | Strands `agent.run` mocked Gemini ile çağrılır; her ajanın `output_schema` validate olduğundan emin ol |
| End-to-end | `test_thesis_pipeline.py` — fixture mode'da `run_thesis("ASELS")` koşar, çıktıda her `[kaynak:<id>]` `tool_call_logs`'da bulunur |

---

## 11. Migrasyon Sırası (önerilen)

1. `backend/` iskelet + `pyproject.toml` + `.env.example` + Docker compose (`docs/stack.md §5`).
2. `app/core/{config,redis,logging}.py` + `app/main.py` lifespan.
3. `scripts/product/*` → `app/data/providers/*` (async + dekoratörler).
4. `app/data/{cache,ratelimit,fixture,registry}.py`.
5. Alembic init + tablolar + pgvector.
6. `app/agents/schemas.py` + `app/agents/tools.py`.
7. Tek ajan PoC: Macro Context (Flash) — uçtan uca ilk WS stream.
8. Sector Router + Technical Worker + Fundamental Worker.
9. Devil's Advocate + Synthesizer (Pro) + citation validator.
10. Memory Agent + nightly cron.
11. `scripts/test/probe_*` → `tests/integration/`.
12. Frontend bağlantısı (ayrı plan).

---

## 12. Kritik Dosyalar (Değişecek / Yeni)

**Mevcut, kaynak olarak okunacak:**
- `scripts/product/{macro,prices,financials,disclosures,technicals,analyst,news,companies,thesis_bundle}.py`
- `scripts/product/config.py`
- `scripts/test/probe_*.py`, `scripts/test/run_all.py`, `scripts/test/config.py`
- `docs/{agents,architecture,data,database,flows,stack,product}.md`
- `BLUEPRINT.md`
- `.env.probe` (değerler `.env`'e taşınır)
- `requirements-probe.txt` (`pyproject.toml`'a genişletilir)

**Yeni:** §2'deki tüm `backend/` ağacı.

---

## 13. Doğrulama (Bitince Nasıl Test Edeceğiz)

1. **Provider katmanı izole:** `pytest backend/tests/unit/data` yeşil; `THESISFORGE_MODE=fixture` ile network-suz koşum.
2. **Probe regression:** `pytest backend/tests/integration -m live` (CI'da nightly) — tüm 7 kaynak OK.
3. **Tek ajan smoke:** `python -m app.agents.macro_context` Macro paragraf üretir, çıktıda 4 sayı + 4 citation.
4. **Uçtan uca:** lokal `docker compose up`; `curl -X POST :8000/api/chat -d '{"ticker":"ASELS"}'`; WS bağlanıp Markdown stream izle; `theses` tablosunda satır + `tool_call_logs` ≥ 10 satır; her `[kaynak:<uuid>]` UUID `tool_call_logs.call_id`'de.
5. **Cache testi:** Aynı ticker 2 dk arayla — 2. çağrı <8 s (cache hit).
6. **Citation enforcement:** Synthesizer'a kasıtlı uydurma sayı zerk et — validator yakalayıp `[KAYNAKSIZ]` flag bassın.
7. **Fallback testi:** TCMB key'i kasıtlı yanlış yap — registry fixture'a düşsün, tez yine üretilsin, UI banner gösterilsin.
8. **Devil's & Memory:** confidence breakdown (`docs/agents.md §6`) 6 bileşenin altıyla da gelsin; memory cron 7 gün önceki test tezini `actual_return` ile güncellesin.
