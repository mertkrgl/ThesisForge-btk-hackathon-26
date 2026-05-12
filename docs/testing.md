# Test ve Gözlemlenebilirlik

> Unit/integration/smoke test stratejisi, CI matrisi, coverage hedefi, OpenTelemetry + structlog şeması, metrik listesi. **"Bir şey çalışıyor mu nasıl anlarız"** sorusunun tek truth file'ı.
>
> İlgili: [`sprint.md`](sprint.md) (gün-gün test görevleri) · [`data.md`](data.md) §7 (fallback senaryoları) · [`flows.md`](flows.md) §3 (citation enforcement)

---

## 1. Test Stratejisi

### 1.1 Unit Testler (Öncelik)

| Test | Hedef | Sebep |
|---|---|---|
| `validate_citations()` | Bozuk citation'lı tez fixture'ı 1-retry + soft flag yapıyor mu | Citation-grounded mimari kritik |
| `sector_router` | 50 BIST hissesi → doğru squad | Yanlış squad → yanlış prompt → tez yanlış |
| `compute_ratios()` | Bilinen finansal table karşılaştır (GARAN NIM, TUPRS refining margin) | Squad-spesifik metrik doğruluğu |
| `chained_data_provider` | Primary fail → secondary, ikisi fail → fixture | Fallback chain güvenilirliği |
| `memory.similar_thesis` | 3 fake tez insert, doğru sıra | pgvector cosine doğru |
| `confidence_score()` | Bilinen breakdown girdi → beklenen toplam | Formül [`agents.md`](agents.md) §6 |
| `conservative_mode_transform()` | Default tez → bear başa, cap=70 | [`agents.md`](agents.md) §5 |

### 1.2 Integration Testler

- **End-to-end pipeline** (mock Gemini ile, deterministik) — Orchestrator → Workers → Devil's → Synthesizer → DB
- **Memory similarity round-trip** — write → embed → read → similar inject
- **Citation enforcement loop** — kasten kırık çıktı → retry → soft flag

### 1.3 Smoke Testler (Gerçek LLM, Gece Cron)

- **5 popüler hisse:** ASELS, GARAN, TUPRS, BIMAS, EREGL
- **Beklenen:** <90s end-to-end, citation pass oranı >%80, DB row eklendi
- **Trigger:** Nightly GitHub Actions + manuel `make smoke`

### 1.4 Fallback Senaryoları

Tam liste: [`data.md`](data.md) §7. Test:

```python
@pytest.mark.asyncio
async def test_yfinance_fail_falls_to_isyatirim(monkeypatch):
    monkeypatch.setattr(YfinanceProvider, "fetch",
                        async_mock(side_effect=ProviderError()))
    result = await fetch("price", "ASELS:ohlcv:90d")
    assert result["provider"] == "isyatirim"
```

---

## 2. Coverage Hedefi

**Kritik path'lerde >%70:**

- `validate_citations` (zorunlu %100)
- `sector_router`
- `chained_data_provider`
- `memory.similar_thesis`
- `compute_ratios` (her squad için)
- Pipeline orchestrator

**Tool:** `pytest-cov` + Codecov. PR'da coverage düşüşü engellenir.

---

## 3. CI Matrisi (GitHub Actions)

### 3.1 PR Trigger

```yaml
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -e ".[dev]"
      - run: pytest tests/unit tests/integration --cov
      - uses: codecov/codecov-action@v4
```

**Süre hedefi:** <5 dakika.

### 3.2 Nightly

```yaml
on:
  schedule:
    - cron: "0 23 * * *"  # 23:00 UTC
jobs:
  smoke:
    runs-on: ubuntu-latest
    env:
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      TCMB_EVDS_KEY: ${{ secrets.TCMB_EVDS_KEY }}
      MKK_API_KEY: ${{ secrets.MKK_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - run: pytest tests/smoke -v
```

**Failure davranışı:** Slack notification (v2). Hackathon'da manuel kontrol.

---

## 4. Gözlemlenebilirlik

### 4.1 OpenTelemetry Trace

Her ajan ve tool için span:

```python
from opentelemetry import trace
tracer = trace.get_tracer(__name__)

async def fetch_ohlcv(ticker: str):
    with tracer.start_as_current_span("tool.yfinance.get_ohlcv") as span:
        span.set_attribute("ticker", ticker)
        result = await yfinance.history(...)
        span.set_attribute("rows", len(result))
        return result
```

Strands native OTel desteği — agent span'leri otomatik.

### 4.2 Structured Logging

`structlog` JSON format:

```python
import structlog
logger = structlog.get_logger()

logger.info("tool_call",
            ticker="ASELS", agent_id="fundamental_worker",
            tool_name="fetch_kap_filings", call_id="uuid-...",
            latency_ms=234, success=True)
```

**Default fields:** `level`, `ts`, `event`, `ticker`, `agent_id`, `call_id`, `latency_ms`, `provider` (data layer için).

### 4.3 Metrikler

| Metrik | Tip | Labels | Niye |
|---|---|---|---|
| `thesis.generation_duration_seconds` | Histogram | `mode` (default/conservative) | Pipeline süresi dağılımı |
| `tool.call.count` | Counter | `tool`, `success` | Hangi tool ne sıklıkla fail |
| `citation.kaynaksiz_count` | Counter | — | Soft flag oranı (sistem güven metriği) |
| `gemini.tokens_used` | Counter | `model` (pro/flash) | Maliyet takibi |
| `provider.fallback.count` | Counter | `domain`, `level` (primary/secondary/fixture) | Hangi kaynak ne kadar düşüyor |
| `kill_switch.trigger.count` | Counter | `reason` (timeout/3fail/manual) | Production stabilite |
| `cache.hit_rate` | Gauge | `key_pattern` | Cache etkinliği |

### 4.4 Lokal Dashboard

Hackathon: Demo öncesi manuel kontrol — `structlog` JSON tail + Postgres query.

Production v2: Grafana + Prometheus + Tempo (OTel collector).

---

## 5. Test Verisi (Fixture)

| Test | Fixture |
|---|---|
| `validate_citations` | `tests/fixtures/broken_citation.json` (kasten ID mismatch) |
| `sector_router` | `tests/fixtures/bist50.csv` (50 hisse + beklenen squad) |
| `compute_ratios` | `tests/fixtures/garan_q3_2026.json` + beklenen NIM/NPL |
| `memory.similar_thesis` | `tests/fixtures/seed_theses.sql` (3 fake tez) |
| Smoke e2e | Gerçek API, fixture yok |

---

## 6. Performans Bütçesi

| Aşama | Hedef | Test |
|---|---|---|
| 3-bacak paralel | <2s | Integration test latency assertion |
| 2-Worker paralel | <20s | Integration test |
| Devil's Advocate (Pro) | <10s | Smoke |
| Synthesizer streaming | TTFT <1s | Smoke |
| Citation validate | <3s | Unit |
| Toplam (canlı) | <60s | Smoke |
| Toplam (pre-warm) | <8s | Smoke |

Aşılırsa: regression alarmı (v2).
