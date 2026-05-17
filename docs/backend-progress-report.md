# ThesisForge Backend — Aşama 1-6 Tamamlanma Raporu

> **Tarih:** 2026-05-14
> **Branch:** develop
> **Durum:** Aşama 1-6 tamamlandı, Aşama 7-10 kaldı
> **Test durumu:** 39/39 unit test yeşil (tüm aşamalar)
> **Sistem:** Backend ayakta, Postgres+pgvector Docker'da çalışıyor

---

## 1. Genel Tablo

| Aşama | Durum | Test | Kritik Çıktı |
|---|---|---|---|
| 1 — Proje iskeleti | ✅ Tamam | manuel curl /health | docker-compose, pyproject, FastAPI |
| 2 — DB skeleton | ✅ Tamam | 6 test | 5 tablo + pgvector + Alembic 001 |
| 3 — DataProvider | ✅ Tamam | 8 test | 17 domain provider chain |
| 4 — Tool/UUID | ✅ Tamam | 10 test | @tool decorator + 25 tool callable |
| 5 — Citation Validator | ✅ Tamam | 10 test | 3 katman regex/PK/numeric |
| 6 — Strands + 3 Ajan + Embedding | ✅ Tamam | 5 test | runtime, macro_context, sector_router, memory_agent |
| **7 — Workers + Critic + Synthesizer** | ⏳ Bekliyor | — | technical/fundamental worker, devils_advocate, synthesizer |
| **8 — Orchestrator** | ⏳ Bekliyor | — | run_thesis() supervisor |
| **9 — API + WebSocket** | ⏳ Bekliyor | — | /chat, WS /ws/thesis/{id}, REST |
| **10 — Nightly Cron** | ⏳ Bekliyor | — | APScheduler outcome update |

**Toplam üretilen kod:** 58 dosya · 4501 satır Python/YAML/SQL · 39 test

---

## 2. Mevcut Sistem — Çalışıyor Olarak

### 2.1 Çalışmakta olan altyapı

- **PostgreSQL 16 + pgvector**: `thesisforge-postgres` container'ı `Up 35min healthy`, port 5432
- **5 tablo + 10 custom indeks** (ivfflat dahil): `users`, `watchlist`, `theses`, `tool_call_logs`, `citations`
- **Alembic** migration 001 uygulanmış
- **FastAPI** `/health` endpoint'i ayakta (uvicorn ile manuel test edildi)

### 2.2 Uçtan uca yapabilen şeyler (LLM gerektirmeden)

```python
# 1. Tez skeleton oluştur
thesis_id = await create_thesis_skeleton(session, ticker="ASELS", squad="Defense")

# 2. Bir tool çağır → UUID damgalı satır + result
ctx = AgentContext(thesis_id=thesis_id, agent_id="technical_worker", session=session)
out = await get_ohlcv(ctx, ticker="THYAO", days=30)
# out = {"call_id": "uuid-str", "result": {...ProviderResult dict}}

# 3. Markdown oluştur (manuel)
md = f"- RSI 67 ölçüldü [kaynak: {out['call_id']}]"

# 4. Validate
report = await validate_citations(md, thesis_id, session)
# report.had_kaynaksiz = False, citations DB'ye yazıldı

# 5. Memory: embed + similarity search
emb = await embed_text("ASELS yatırım tezi")  # Gemini key varsa real, yoksa stub
hits = await search_memory(ctx, "ASELS", "ASELS yatırım tezi", top_k=3)
```

### 2.3 Çalışmakta olan 17 DataProvider chain'i

`price`, `index`, `dividend`, `brent`, `financials`, `ratios`, `kap_recent`, `kap_company`, `technicals`, `analyst`, `fx`, `macro`, `news_company`, `news_market`, `companies`, `company_lookup`, `thesis_bundle`

Her chain: `primary provider → secondary → fixture` + in-memory TTL cache.

### 2.4 Çalışmakta olan 25 tool

**Macro Context (4):** `get_tcmb_indicators`, `get_bist_index_state`, `get_global_signals`, `get_recent_macro_news`
**Orchestrator (2):** `validate_ticker`, `get_macro_context`
**Sector Router (2):** `lookup_sector`, `select_squad`
**Technical Worker (5):** `get_ohlcv`, `calculate_indicators`, `detect_patterns`, `find_support_resistance`, `relative_strength`
**Fundamental Worker (6):** `fetch_kap_filings`, `get_financial_statements`, `compute_ratios`, `get_sector_peers`, `compare_to_peers`, `get_dividend_history`
**Devil's Advocate (3):** `query_workers`, `find_disconfirming_evidence`, `base_rate_check`
**Memory (3):** `embed_text`, `similarity_search`, `write_thesis_embedding`

Her tool iki katman:
- `tool_registry.py`: `AgentContext`'li, `@tool(name)` ile UUID damgalı, DB-aware
- `strands_tools.py`: Strands `@tool` ile sarılmış, contextvar bridge ile bağlanmış

---

## 3. Aşama 1-6 Detaylı Yapılanlar

### 3.1 Aşama 1 — Proje İskeleti

**Yeni dosyalar:**
- `docker-compose.yml` (repo root, sadece postgres servisi)
- `backend/pyproject.toml` (Python 3.11+, ~30 runtime dep, dev extra)
- `backend/.env.example` (spec §18 + Gemini-only embedding)
- `backend/.gitignore`
- `backend/app/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/core/config.py` — Pydantic Settings, `.env.probe` + `.env` chain, `PRODUCT_SCRIPTS_PATH` resolve
- `backend/app/core/logging.py` — structlog (dev: console, prod: JSON)
- `backend/app/core/paths.py` — `ensure_product_path()` sys.path helper
- `backend/app/main.py` — FastAPI + lifespan + `/health`

**Doğrulama:** `curl localhost:8000/health` → `{"status":"ok","env":"dev"}` ✓

### 3.2 Aşama 2 — DB Skeleton

**Yeni dosyalar:**
- `backend/app/db/__init__.py`
- `backend/app/db/models.py` — 5 model (SQLAlchemy 2.0 + pgvector)
- `backend/app/db/session.py` — async engine, `session_scope()` ctx manager
- `backend/alembic.ini`
- `backend/alembic/env.py` — async migration runner
- `backend/alembic/script.py.mako`
- `backend/alembic/versions/001_initial_schema.py` — el yazımı (autogen pgvector ile sorunlu)
- `backend/app/db/repo.py` — CRUD: `ensure_user`, `create_thesis_skeleton`, `insert_tool_call_log`, `get_tool_call_log`, `insert_citation`, `update_thesis_kaynaksiz_flag`, `get_thesis`
- `backend/tests/conftest.py` — `pg_session` fixture (transaction-rollback)
- `backend/tests/unit/test_repo.py` — 6 test

**Şema notları:**
- `theses.embedding VECTOR(768)` + `idx_theses_embedding USING ivfflat (vector_cosine_ops)`
- `theses.outcome` CHECK: correct/partial/wrong/pending
- `citations` CHECK: is_kaynaksiz↔call_id consistency
- Partial index: `idx_theses_outcome_pending WHERE outcome='pending'` (cron için)

### 3.3 Aşama 3 — DataProvider Katmanı

**Yeni dosyalar:**
- `backend/app/data/__init__.py`
- `backend/app/data/providers/__init__.py`
- `backend/app/data/providers/base.py` — `DataProvider` ABC, `ProviderResult`, `DataUnavailable`
- `backend/app/data/cache.py` — `CacheBackend` ABC + `InMemoryCache` (cachetools.TTLCache bucket per TTL); Redis `NotImplementedError` (Aşama 13)
- `backend/app/data/fixture.py` — disk JSON read/write (`<FIXTURE_ROOT>/<domain>/<key>.json`)
- `backend/app/data/ratelimit.py` — per-source `aiolimiter.AsyncLimiter`
- `backend/app/data/registry.py` — `ChainedDataProvider` + `build_registry()` (17 domain)
- `backend/app/data/providers/prices.py` — `YFinancePriceProvider`, `IsyatirimPriceProvider`, `IndexProvider`, `DividendProvider`, `BrentOilProvider`
- `backend/app/data/providers/macro.py` — `TCMBMacroProvider`
- `backend/app/data/providers/financials.py` — `IsyatirimFinancialsProvider`, `RatiosProvider`
- `backend/app/data/providers/disclosures.py` — `MkkDisclosuresProvider`, `CompanyDisclosuresProvider`, `PykapDisclosuresProvider`
- `backend/app/data/providers/technicals.py` — `PandasTaTechnicalsProvider`
- `backend/app/data/providers/analyst.py` — `BorsapyAnalystProvider`, `FxRateProvider`
- `backend/app/data/providers/news.py` — `GoogleCompanyNewsProvider`, `GoogleMarketNewsProvider`
- `backend/app/data/providers/companies.py` — `MkkCompaniesProvider`, `CompanyLookupProvider`
- `backend/app/data/providers/thesis_bundle.py` — `ThesisBundleProvider`
- `backend/fixtures/{price,kap,fin,analyst,peers,news,macro,thesis,index,dividend}/.gitkeep`
- `backend/fixtures/macro/latest.json` — örnek
- `backend/tests/unit/test_data_chain.py` — 8 test

**Mimari:**
- Tüm provider'lar `scripts/product/*.py` sync fn'lerini `asyncio.to_thread` ile sarar
- `ensure_product_path()` import-time `sys.path.insert(0, scripts/product)` (modüller bare import yapıyor)
- DataFrame'ler `.to_dict("records")` ile JSON-safe payload'a dönüştürülür
- Provider raise → `DataUnavailable` → chain devam → fixture fallback

### 3.4 Aşama 4 — Tool Registry + UUID Damgalama ⭐

**Yeni dosyalar:**
- `backend/app/agents/__init__.py`
- `backend/app/agents/schemas.py` — spec §17'nin tümü (Observation, CitationRecord, MacroContextOutput, TechnicalAnalysis, FundamentalAnalysis, Critique, MemoryHit, BullBearPoint, Catalyst, ConfidenceBreakdown, ThesisOutput)
- `backend/app/agents/tools.py` — `AgentContext` dataclass + `@tool(name)` decorator + contextvar `current_agent_context` + `use_agent_context()` ctx manager
- `backend/app/agents/tool_registry.py` — 25 deterministik tool callable
- `backend/app/agents/sector_map.py` — yaml loader, `squad_for_ticker`, `metrics_for_squad`, `prompt_file_for_squad`
- `backend/sector_map.yaml` — spec §8 birebir (5+1 squad)
- `backend/tests/unit/test_tool_decorator.py` — 10 test

**Kritik akış:**
```
Agent → @tool wrapper → ChainedDataProvider.fetch()
                     → insert_tool_call_log RETURNING call_id
                     → ctx.last_call_id = call_id
                     → {"call_id": str(uuid), "result": payload} döner
```

Exception path: latency_ms logla, **DB satırı yazma**, raise.

### 3.5 Aşama 5 — Citation Validator ⭐

**Yeni dosyalar:**
- `backend/app/citations/__init__.py`
- `backend/app/citations/numbers.py` — `extract_numbers`, `number_appears_in`, `find_unsupported_numbers` (Türkçe %, virgül/nokta normalize)
- `backend/app/citations/validator.py` — 3 katman: regex parse → PK lookup → numeric sanity, retry hook, `ValidationReport`
- `backend/tests/unit/test_citation_validator.py` — 10 test

**Kritik detaylar:**
- UUID regex: `\[kaynak:\s*([a-f0-9-]{36})\]`
- Cümle sınırı: `\n` VEYA önceki `[kaynak: ...]` etiketinin sonu (önceki claim'in sayıları başka claim'in numeric check'ine sızmaz)
- Numeric issue olan UUID'ler `bad_uuids` setine eklenir, citation kaynaksız INSERT edilir
- Retry: 1 kez (`synthesizer_retry_fn` callable), 2. başarısızlık → soft flag

### 3.6 Aşama 6 — Strands + 3 Ajan + Gemini Embedding

**Bu turda eklenen yeni:**
- `backend/app/agents/runtime.py` — `flash_model()`, `pro_model()`, `read_prompt()`, `build_agent()`, `run_agent_with_context()` (contextvar üzerinden)
- `backend/app/agents/strands_tools.py` — 23 Strands `@tool` wrapper (her `tool_registry.py` fn için ince katman); grup listeleri: `MACRO_TOOLS`, `TECHNICAL_TOOLS`, `FUNDAMENTAL_TOOLS`, `DEVILS_ADVOCATE_TOOLS`, `MEMORY_TOOLS`, `SECTOR_ROUTER_TOOLS`, `ORCHESTRATOR_TOOLS`
- `backend/app/agents/embedding.py` — Gemini `text-embedding-004` 768-dim Matryoshka; API key yoksa **deterministik seed-based fallback** (test ve dev için)
- `backend/app/agents/macro_context.py` — `run_macro_context(ctx)` → `MacroContextOutput`
- `backend/app/agents/sector_router.py` — `run_sector_router(ctx, ticker)` → `SectorAssignment` (rule-based primary, LLM fallback)
- `backend/app/agents/memory_agent.py` — `search_memory(ctx, ticker, query_text, top_k)` + `write_thesis_embedding_async(thesis_id, md)` (fire-and-forget, kendi session açar)
- `backend/app/agents/prompts/macro_context.md`
- `backend/app/agents/prompts/sector_router.md`
- `backend/app/agents/prompts/memory_agent.md`
- `backend/tests/unit/test_memory_agent.py` — 5 test

**Bu turda değişiklikler:**
- `pyproject.toml` — `strands-agents[gemini]>=1.39`, `google-genai>=1.0` runtime'a taşındı (optional `llm` group kaldırıldı)
- `.env.example` ve `core/config.py` — OpenAI alanları çıkarıldı, `GEMINI_EMBED_MODEL=text-embedding-004` + `GEMINI_EMBED_DIMENSIONS=768`
- `app/agents/tools.py` — `current_agent_context` ContextVar + `use_agent_context()` ctx manager + `get_current_context()` helper eklendi
- `app/agents/tool_registry.py` — `embed_text/similarity_search/write_thesis_embedding` stub'lar **gerçek** Gemini SDK + pgvector implementasyonu ile değiştirildi
- `app/db/repo.py` — `similarity_search`, `get_pending_theses`, `update_thesis_outcome`, `update_thesis_synthesis`, `_vec_to_pg` helper eklendi (asyncpg vector string format)

**Strands model wiring:**
```python
from strands.models.gemini import GeminiModel
model = GeminiModel(
    client_args={"api_key": settings.GEMINI_API_KEY},
    model_id="gemini-2.5-flash",  # veya "gemini-2.5-pro"
    params={"temperature": 0.3, "max_output_tokens": 4096},
)
agent = Agent(model=model, tools=[...], system_prompt=...,
              structured_output_model=SomePydanticModel)
```

**Embedding stack:**
- `google.genai.Client(api_key=...).models.embed_content(model="text-embedding-004", contents=text, config=EmbedContentConfig(task_type="SEMANTIC_SIMILARITY", output_dimensionality=768))`
- API key yoksa veya hata olursa: deterministik seed-based 768-d vector → testler kırılmaz, dev ortamında pipeline çalışır

---

## 4. Aşama 7-10 — Kalan İş

### 4.1 Aşama 7 — Worker'lar + Devil's Advocate + Synthesizer (tahmini 2 gün)

**Hedef:** Tam komite uçtan uca çalışıyor (ama orchestrator yok henüz).

**Yeni dosyalar:**
- `backend/app/agents/technical_worker.py`
  - `run_technical_worker(ctx, ticker, squad) -> TechnicalAnalysis`
  - Flash model, 5 tool (`get_ohlcv`, `calculate_indicators`, `detect_patterns`, `find_support_resistance`, `relative_strength`)
  - Strands Agent + structured_output_model=TechnicalAnalysis

- `backend/app/agents/fundamental_worker.py`
  - `run_fundamental_worker(ctx, ticker, squad) -> FundamentalAnalysis`
  - Flash model, 6 tool
  - **Squad-specific prompt** seçimi: `prompt_file_for_squad(squad)` → 6 farklı .md
  - `key_metrics` squad'a özel (Banking: NIM/CAR/NPL, Energy: refining_margin, vb.)

- `backend/app/agents/devils_advocate.py`
  - `run_devils_advocate(ctx, ticker, tech, fund) -> Critique`
  - **Pro model** (kalite kritik)
  - 3 tool (`query_workers`, `find_disconfirming_evidence`, `base_rate_check`)
  - 2 paragraf karşı argüman + base rate uyarısı

- `backend/app/agents/synthesizer.py`
  - `run_synthesizer(ctx, macro, tech, fund, critique, memory_hits, user_mode) -> ThesisOutput`
  - **Pro model**
  - **NO tools** — sadece markdown generation
  - Stream desteği (`agent.stream_async()` veya benzeri)
  - Conservative mode: bear case başa, confidence ≤70 cap, temettü vurgu
  - Tüm Observation listesini Synthesizer context'ine inject (call_id'leri etiket olarak basabilsin)
  - **Confidence formula** burada hesaplanır (§12)

**Yeni prompt dosyaları:**
- `backend/app/agents/prompts/technical_worker.md`
- `backend/app/agents/prompts/fundamental_banking.md`
- `backend/app/agents/prompts/fundamental_energy.md`
- `backend/app/agents/prompts/fundamental_defense.md`
- `backend/app/agents/prompts/fundamental_retail.md`
- `backend/app/agents/prompts/fundamental_realestate.md`
- `backend/app/agents/prompts/fundamental_generic.md`
- `backend/app/agents/prompts/devils_advocate.md`
- `backend/app/agents/prompts/synthesizer.md`
- `backend/app/agents/prompts/synthesizer_conservative.md`

**Yardımcı modül:**
- `backend/app/agents/confidence.py` (yeni) — `compute_confidence(data_quality, tech, fund, news_macro, memory_base, devil_inverse, user_mode)` → `ConfidenceBreakdown`

**Test stratejisi:**
- `backend/tests/unit/test_workers.py` — Mocked Gemini ile her worker'ın Pydantic schema dönüşü
- `backend/tests/unit/test_synthesizer.py` — Confidence formula + conservative cap
- `backend/tests/unit/test_devils_advocate.py` — base_rate_check entegrasyonu

**Risk noktası:** Strands `Agent.stream_async()` veya callback_handler API'sini doğrulamak gerek. Synthesizer streaming WS için kritik. Belki:
- Synthesizer agent'ından markdown çıktısını topla → WS'e parçalar halinde yolla
- VEYA Strands `callback_handler` callback'iyle direkt stream

### 4.2 Aşama 8 — Orchestrator (tahmini 1 gün)

**Hedef:** Uçtan uca pipeline tek `run_thesis()` çağrısıyla çalışıyor.

**Yeni dosyalar:**
- `backend/app/agents/orchestrator.py`
  ```python
  async def run_thesis(
      ticker: str,
      user_id: uuid.UUID | None,
      user_mode: str = "default",
      *,
      websocket_emit: Callable | None = None,  # WS canlı stream için
  ) -> uuid.UUID:
      # 1. Thesis skeleton INSERT
      # 2. 3-bacak paralel: sector_router | macro_context | memory_search
      # 3. 2-worker paralel: technical | fundamental
      # 4. devils_advocate
      # 5. synthesizer → thesis_md
      # 6. citation_validator (retry callback synthesizer'a)
      # 7. persist: update_thesis_synthesis + citations INSERT
      # 8. asyncio.create_task(write_thesis_embedding_async(...))
      return thesis_id
  ```

- `backend/tests/integration/__init__.py`
- `backend/tests/integration/test_orchestrator.py`
  - Fixture mode (mocked Gemini) end-to-end
  - 1 ticker → tez markdown + citations + had_kaynaksiz=False

**WS stream entegrasyonu:** orchestrator `websocket_emit` callback alır; her ajan başladığında / tool çağrılınca / synthesizer token üretince emit eder.

### 4.3 Aşama 9 — FastAPI + WebSocket (tahmini 1 gün)

**Hedef:** HTTP + WS endpoint'ler canlı; frontend bağlanabilir.

**Yeni dosyalar:**
- `backend/app/api/__init__.py`
- `backend/app/api/chat.py` — `POST /chat`
  - Body: `{message: str, user_id?: uuid, mode?: "default"|"conservative"}`
  - Ticker NLP parse (regex: BIST symbol)
  - `thesis_id = await orchestrator.run_thesis(...)` background task
  - Response: `{thesis_id, ws_url: "/ws/thesis/{thesis_id}"}`

- `backend/app/api/thesis_ws.py` — `WS /ws/thesis/{thesis_id}`
  - Server → Client mesajları: `{type: "tool_start", ...}`, `{type: "tool_end", call_id, latency}`, `{type: "token", content}`, `{type: "done", thesis_id}`, `{type: "error", msg}`
  - `?force_demo=1` killswitch → `fixtures/thesis/<TICKER>.json` 8s yapay delay ile stream

- `backend/app/api/thesis_rest.py`
  - `GET /api/thesis/{id}` → full thesis + confidence + bull/bear/catalysts
  - `GET /api/thesis/{id}/citations` → claim/call_id/tool_result tooltip içerikleri

- `backend/app/api/watchlist.py`
  - `GET /api/watchlist?user_id=...`
  - `POST /api/watchlist` body `{user_id, ticker}`
  - `DELETE /api/watchlist/{ticker}?user_id=...`

- `backend/app/api/admin.py`
  - `POST /admin/cron-now` → manuel cron tetikle (test)

**main.py değişiklikleri:**
- Tüm router'ları `app.include_router(...)` ile register et
- CORS middleware (frontend port 3000)
- lifespan'de `start_scheduler()` çağrı (Aşama 10'da gelecek)

**Test:**
- `backend/tests/integration/test_api.py` — TestClient ile 5 endpoint smoke

**Risk:** WebSocket stream + Strands callback_handler entegrasyonu. Synthesizer markdown'ı parça parça WS'e gönderirken, validator hâlâ son markdown üzerinde çalışmalı.

### 4.4 Aşama 10 — Nightly Cron (tahmini 0.5 gün)

**Hedef:** Outcome update otomatik (T+30 günde tezleri değerlendir).

**Yeni dosyalar:**
- `backend/app/cron/__init__.py`
- `backend/app/cron/nightly_outcomes.py`
  ```python
  async def update_outcomes():
      async with session_scope() as s:
          pending = await get_pending_theses(s, older_than_days=7)
          for thesis in pending:
              # yfinance ile T+7, T+30, T+90 kapanışları çek
              # ground_truth_return hesapla
              # outcome label: bull thesis → ret>5%=correct, <-5%=wrong, else partial
              await update_thesis_outcome(s, thesis.id, ...)
          await s.commit()

  def start_scheduler():
      sched = AsyncIOScheduler()
      sched.add_job(update_outcomes, "cron", hour=2, minute=0)
      sched.start()
      return sched
  ```

**main.py lifespan:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = start_scheduler()
    yield
    sched.shutdown()
```

**Test:**
- `backend/tests/unit/test_cron.py` — bir pending tez seed et, `update_outcomes()` çağır, outcome dolduğunu doğrula (yfinance mock)

---

## 5. Stage 7-10 İçin Önemli Kararlar / Açık Sorular

Bu kararlar implementasyondan önce netleştirilmeli:

### 5.1 Synthesizer streaming

Spec WS'e token-token stream istiyor. İki seçenek:
- **(A) Tam markdown topla, validate, sonra parça parça WS'e gönder** — daha güvenli, validate'tan sonra kullanıcı kaynaksız claim görmez
- **(B) Strands `callback_handler` ile her token'ı doğrudan WS'e at, validate sona kalır** — daha hızlı görünüm ama kaynaksız claim'i kullanıcı görür sonra silinmesi gerekir
- Önerilen: **(A)** — hackathon demo için validate sonrası stream daha güvenli. "Düşünüyor..." status mesajlarıyla LLM beklerken kullanıcı boş bakmıyor.

### 5.2 Fundamental Worker squad-prompt seçimi

Her squad için ayrı .md prompt. Sorun: aynı agent farklı promptlarla mı yeniden inşa edilsin (her ticker için bir Agent), yoksa **tek agent + dinamik system_prompt**?
- Strands `Agent` lifecycle pahalı değil, her run için yeniden inşa OK. Önerilen: her ticker için fresh Agent.

### 5.3 Devil's Advocate Pro maliyeti

Pro her çağrıda paralı. Aşama 7 başında belki **Flash + temperature düşük** ile başlayıp performansa göre Pro'ya geç. Spec Pro istiyor ama hackathon bütçesi gözetilmeli.

### 5.4 Cron job — Docker'da nasıl çalışacak?

APScheduler in-process. Uvicorn restart'ta cron resetlenir. Hackathon scope'unda OK ama:
- Demo süresi kısa, restart'lar olabilir
- Manuel `/admin/cron-now` ile fallback var

### 5.5 Frontend bağlantı

Aşama 9 sonunda frontend hâlâ boş. Onu da yapmamız mı bekleniyor, yoksa ayrı tur mu?

### 5.6 LLM API key

Gemini key gerekli (Aşama 7+ test edilebilir olması için). Test edilmeden Aşama 7-10 yazılabilir ama bir noktada gerçek key ile end-to-end smoke test gerekiyor.

---

## 6. Kalan İş İçin Tahmini Süre

| Aşama | Tahmini süre | Bağımlılık |
|---|---|---|
| 7 — Workers + Critic + Synthesizer | 1.5–2 gün | Gemini API key |
| 8 — Orchestrator | 0.5–1 gün | Aşama 7 |
| 9 — API + WebSocket | 1 gün | Aşama 8 |
| 10 — Nightly Cron | 0.5 gün | Aşama 8 |
| **Toplam** | **3.5–4.5 gün** | |

Hackathon 2026-05-20 teslim hedefi (BTK 2026 takvim): bugün 14 Mayıs, **6 gün kaldı**. Backend tarafı için bolca zaman var; ama frontend ve demo cilası da bekliyor.

---

## 7. Dosya Manifesti (Aşama 1-6)

```
btk-hackathon-26/
├── docker-compose.yml                          # postgres + pgvector
├── docs/
│   └── backend-progress-report.md              # bu dokuman
└── backend/
    ├── .env.example
    ├── .gitignore
    ├── pyproject.toml
    ├── alembic.ini
    ├── alembic/
    │   ├── env.py
    │   ├── script.py.mako
    │   └── versions/
    │       └── 001_initial_schema.py
    ├── sector_map.yaml
    ├── fixtures/                               # disk fixture store
    │   ├── analyst/.gitkeep
    │   ├── dividend/.gitkeep
    │   ├── fin/.gitkeep
    │   ├── index/.gitkeep
    │   ├── kap/.gitkeep
    │   ├── macro/{.gitkeep, latest.json}
    │   ├── news/.gitkeep
    │   ├── peers/.gitkeep
    │   ├── price/.gitkeep
    │   └── thesis/.gitkeep
    ├── app/
    │   ├── __init__.py
    │   ├── main.py                             # FastAPI + /health
    │   ├── core/
    │   │   ├── __init__.py
    │   │   ├── config.py                       # Pydantic Settings
    │   │   ├── logging.py                      # structlog
    │   │   └── paths.py                        # scripts/product sys.path
    │   ├── db/
    │   │   ├── __init__.py
    │   │   ├── models.py                       # 5 SQLAlchemy model
    │   │   ├── session.py                      # async engine
    │   │   └── repo.py                         # CRUD + similarity_search
    │   ├── data/
    │   │   ├── __init__.py
    │   │   ├── cache.py                        # InMemoryCache
    │   │   ├── fixture.py                      # disk JSON store
    │   │   ├── ratelimit.py                    # aiolimiter
    │   │   ├── registry.py                     # ChainedDataProvider + 17 domain
    │   │   └── providers/
    │   │       ├── __init__.py
    │   │       ├── base.py                     # DataProvider ABC
    │   │       ├── analyst.py                  # borsapy
    │   │       ├── companies.py                # MKK
    │   │       ├── disclosures.py              # MKK + pykap
    │   │       ├── financials.py               # isyatirim
    │   │       ├── macro.py                    # TCMB
    │   │       ├── news.py                     # Google News
    │   │       ├── prices.py                   # yfinance + isyatirim
    │   │       ├── technicals.py               # pandas-ta
    │   │       └── thesis_bundle.py
    │   ├── agents/
    │   │   ├── __init__.py
    │   │   ├── schemas.py                      # Pydantic v2 §17 tamamı
    │   │   ├── sector_map.py                   # yaml loader
    │   │   ├── tools.py                        # @tool + AgentContext + contextvar
    │   │   ├── tool_registry.py                # 25 tool callable
    │   │   ├── strands_tools.py                # Strands @tool wrapper'lar
    │   │   ├── runtime.py                      # Gemini model + build_agent
    │   │   ├── embedding.py                    # Gemini text-embedding-004
    │   │   ├── macro_context.py                # ⭐ Aşama 6
    │   │   ├── sector_router.py                # ⭐ Aşama 6
    │   │   ├── memory_agent.py                 # ⭐ Aşama 6
    │   │   └── prompts/
    │   │       ├── macro_context.md
    │   │       ├── memory_agent.md
    │   │       └── sector_router.md
    │   └── citations/
    │       ├── __init__.py
    │       ├── numbers.py                      # numeric sanity
    │       └── validator.py                    # 3 katman
    └── tests/
        ├── __init__.py
        ├── conftest.py                         # pg_session rollback fixture
        └── unit/
            ├── __init__.py
            ├── test_repo.py                    # 6 test (Aşama 2)
            ├── test_data_chain.py              # 8 test (Aşama 3)
            ├── test_tool_decorator.py          # 10 test (Aşama 4)
            ├── test_citation_validator.py     # 10 test (Aşama 5)
            └── test_memory_agent.py            # 5 test (Aşama 6)
```

**Toplam:** 58 dosya · 4501 satır · 39 unit test (39/39 yeşil)

---

## 8. Bir Sonraki Tur Başlamadan Önce Yapılacaklar

1. **Gemini API key** alın ve `backend/.env`'e veya `.env.probe`'a ekleyin:
   ```
   GEMINI_API_KEY=...
   ```
2. (Opsiyonel) Strands kütüphanesi davranışını netleştir: `Agent.structured_output()` vs `Agent.__call__()` farkları, streaming için `callback_handler` API
3. Synthesizer stream stratejisi seçimi: (A) validate-sonra-stream mı, (B) anlık-stream-sonra-validate mı? — section 5.1
4. Aşama 7'yi başlatma kararı: bütün ajanları aynı turda yazmak mı, yoksa **technical_worker** ile başlayıp birer birer mi?

Bu rapor sıradaki sohbet için self-contained referans olarak `docs/backend-progress-report.md`'de saklandı.
