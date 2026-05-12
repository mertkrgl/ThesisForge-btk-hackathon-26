# Sprint Planı — 7 Gün, 3 Kişi

> Ekip rolleri, gün-gün görev tablosu, daily ritüel, risk önceliği ve bağımlılık haritası. **"Bugün kim ne yapıyor"** sorusunun tek truth file'ı.
>
> İlgili: [`product.md`](product.md) (problem) · [`agents.md`](agents.md) · [`data.md`](data.md) · [`stack.md`](stack.md) · [`risks.md`](risks.md) · [`demo.md`](demo.md)

---

## 1. Ekip Rolleri

| Rumuz | Rol | Sorumluluk | Stack |
|---|---|---|---|
| **A** | Agent Lead | Backend ajanlar, LLM, Synthesizer, Devil's, citation | Python, FastAPI, Gemini SDK, pydantic |
| **B** | Data/DevOps Lead | Veri, persistence, Docker, CI/CD | Python, SQL, Docker, GitHub Actions |
| **C** | Frontend Lead | UI/UX, demo | Next.js 15, Tailwind, shadcn/ui, recharts |

**Owner-dosya eşleştirmesi:** A → [`agents.md`](agents.md), [`flows.md`](flows.md). B → [`data.md`](data.md), [`database.md`](database.md). C → [`stack.md`](stack.md) (frontend), [`demo.md`](demo.md).

---

## 2. Gün-Gün Görev Tablosu

### Gün 1 — Foundation & Setup

| Kişi | Görev |
|---|---|
| **A** | Repo iskelet (`backend/`, `frontend/`, `docker/`), FastAPI `/health`, **Gemini Tier 1 paid plan aktif**, dummy agent (echo). `POST /chat` çalışır. |
| **B** | `docker-compose.yml` (postgres+pgvector, redis, backend, frontend) — [`stack.md`](stack.md) §5. `.env.example`. Alembic migration framework + ilk migration (users, theses, tool_call_logs, citations) — [`database.md`](database.md) §1. **TCMB EVDS + MKK API Portal kaydı** — [`data.md`](data.md) §6.1, §6.2. **Onay gecikme riski → gün başında 09:00'da başlat.** `pip install isyatirimhisse borsapy yfinance pandas-ta` smoke test. |
| **C** | Next.js 15 + Tailwind + shadcn/ui. Layout (header, sidebar/watchlist, main/chat). Mock chat UI. |

**Senkron:** `docker compose up` → tüm servisler 200.

### Gün 2 — Data Pipeline & Macro Context

| Kişi | Görev |
|---|---|
| **A** | Agent base class (`BaseAgent`), Macro Context Agent (Flash, 15dk cache) — [`agents.md`](agents.md) §2.1. Orchestrator iskeleti, prompt registry. |
| **B** | `tools/yfinance_tool.py`, `tools/isyatirim_tool.py`, `tools/kap_rss_tool.py`, `tools/mkk_api_tool.py`, `tools/pandas_ta_tool.py`, `tools/tcmb_evds_tool.py`. **`DataProvider` interface + `ChainedDataProvider`** — [`data.md`](data.md) §5. Redis cache wrapper. `sector_map.yaml` (BIST 50, 5+1 squad) — [`agents.md`](agents.md) §3. Unit test: GARAN NIM doğru. |
| **C** | Backend `/api/macro` bağlantısı (gerçek), watchlist component (ekleme/çıkarma), chat input + REST polling. |

**Senkron:** Macro Agent JSON üretir, UI'da panel canlı.

### Gün 3 — Workers + Sector Router

| Kişi | Görev |
|---|---|
| **A** | Sector Router Agent, Technical Worker (pandas-ta, max 5 tool), Fundamental Worker (5 squad-spesifik sub-prompt) — [`agents.md`](agents.md) §2.4, §2.5. Orchestrator paralel dispatch (`asyncio.gather`). |
| **B** | KAP scraper fallback (Playwright, 1 req/sn, robots.txt). Worker output Pydantic şemaları. `citations` tablosu yazma (her tool call → call_id) — [`database.md`](database.md) §1.2. Unit test: Sector Router 50 hisse → doğru squad. Fixture writer ilk versiyon. |
| **C** | Thesis Viewer iskeleti (Markdown render, grafik placeholder). Worker status UI (her worker kart, pending/done/error). Squad badge. Mobile responsive. |

**Senkron:** ASELS isteği → Sector Router → 2 worker paralel → JSON UI'da.

### Gün 4 — 🎯 MVP: Devil's + Synthesizer + Citation

| Kişi | Görev |
|---|---|
| **A** | Devil's Advocate Agent (**Pro**, bear argümanları), Synthesizer Agent (**Pro**, streaming Markdown), Synthesizer prompt (bull/bear/catalysts/risks/confidence breakdown) — [`agents.md`](agents.md) §2.6, §2.7, §6. `user_mode` parametresi taslağı. Citation Validator (ID-bazlı + 1-retry + `[KAYNAKSIZ]` flag) — [`flows.md`](flows.md) §3. |
| **B** | Tez DB yazma: embedding + pgvector. Memory Agent write-only — [`flows.md`](flows.md) §4. `compute_ratios` integration test (3 squad). Citation Validator unit test (bozuk citation fixture). Smoke test CLI (e2e). |
| **C** | Thesis Viewer Markdown stream render (token-by-token). Bull/Bear collapsible. Citation tooltip. Confidence bar (recharts). `[KAYNAKSIZ]` flag uyarı stilleri. |

**🎯 MVP TANIMI (Gün 4 sonu):**
1. Tek hisse bull/bear/catalysts/risks
2. Citation-grounded (1-retry + soft flag)
3. Memory Agent yazıyor (similarity henüz yok)
4. Smoke test 3 hisse yeşil (ASELS, GARAN, TUPRS), e2e <60s

### Gün 5 — Frontend Tamamlama + WebSocket + Memory Similarity

| Kişi | Görev |
|---|---|
| **A** | WebSocket endpoint (`/ws/thesis`), Memory similarity search (top_k=3 inject) — [`flows.md`](flows.md) §4.2. Memory prompt template. Orchestrator WS-aware event push. |
| **B** | Memory read path: `similar_thesis(ticker, top_k)` pgvector cosine — [`database.md`](database.md) §4.1. Gece cron iskeleti (henüz koşmuyor). 3 fake tez + similarity test. Integration test (mock LLM ile e2e). **GitHub Actions: PR unit + integration.** |
| **C** | WebSocket client + **auto-reconnect + REST polling degrade** — [`stack.md`](stack.md) §3. Streaming UI (typing animation). "Geçmiş Tezler" panel (zaman çizelgesi). Similarity kart. Watchlist gerçek backend CRUD. |

### Gün 6 — Conservative Mode + Tests + Polish

| Kişi | Görev |
|---|---|
| **A** | Conservative mode tam (bear başa, confidence cap=70, temettü vurgulu, volatilite uyarısı, uygunluk özeti) — [`agents.md`](agents.md) §5, [`flows.md`](flows.md) §5. Edge case'ler (zayıf veri graceful degrade). **Pre-warmed cache mekanizması (5-10 demo hissesi)** — [`demo.md`](demo.md) §2. |
| **B** | Coverage >%70 kritik path — [`testing.md`](testing.md) §1. Smoke 5 hisse (gerçek LLM). Gece cron çalışır hale (manuel test). **Demo kill-switch implementasyonu** — [`flows.md`](flows.md) §6. Prod env vars + secrets review. Demo deploy (Railway + Supabase + Upstash + Vercel). |
| **C** | Conservative UI toggle (Ali Bey persona default). Demo animasyonlar. Empty state UI'lar. Error boundaries + retry. Mobile + tablet son geçiş. |

**Senkron:** End-to-end dry run.

### Gün 7 — Demo + Video + Submission

| Kişi | Görev |
|---|---|
| **A** | Sunum teknik kısım (mimari slide, ajan ailesi, Pro/Flash split, kill-switch). Canlı demo 3 persona. Edge case fallback'leri. Q&A notları. |
| **B** | Production smoke test. Pre-warmed cache final populate (kill-switch fixture'larını da güncelle). `README.md`, `BLUEPRINT.md` finalize. GitHub repo temizlik (secret kontrol). Submission deploy URL test. |
| **C** | Sunum ürün kısım (personalar, problem, değer). **Demo video kaydı (3-5dk, scripted)** — [`demo.md`](demo.md) §4. |

**Submission checklist:** [`demo.md`](demo.md) §5.

---

## 3. Daily Ritüel

- **09:00** — 15dk standup (dün/bugün/blocker)
- **12:30** — Hızlı sync (öğle)
- **18:00** — Demo dry run (Gün 4'ten itibaren, 5dk)
- **22:00** — Soft cutoff (commit + push, ertesi güne hazır)

---

## 4. Risk Öncelik Tablosu

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

Tam risk listesi: [`risks.md`](risks.md).

---

## 5. Bağımlılık Haritası — Kim Kimi Bekliyor?

```
Gün 1: A, B, C paralel (kimse beklemiyor)
Gün 2: A → B (Macro Agent tool'lara ihtiyaç duyar)
       C → A (chat UI macro endpoint'i çağırır)
Gün 3: A → B (Worker'lar provider chain'e ihtiyaç duyar)
       C → A (worker status event'leri için)
Gün 4: A → B (Memory write için pgvector hazır olmalı)
       C → A (Synthesizer streaming event şeması)
Gün 5: A → B (similarity SQL hazır olmalı)
       C → A (WebSocket endpoint hazır olmalı)
Gün 6: B → A (kill-switch fixture'ları için pre-warm cache)
       C → A (conservative mode prompt çıktısı için)
Gün 7: B → A,C (deploy URL hazır olmalı)
```

**Blocker önceliği:** B → A → C (data layer → agent → UI sırası). A ve C, B'nin bittiği işin üstüne kurar.

---

## 6. Pre-Warm 24 Saat Çizelgesi

Demo Gün 7 → Gün 6 akşamı 22:00:

1. `scripts/refresh_fixtures.py` — 10 hisse için tüm fixture'lar tazelenir
2. `scripts/warmup.py` — Redis `demo:warm:<TICKER>` keys doldurulur
3. Smoke test — 3 hisse e2e <8s
4. Kill-switch fixture'ları (`fixtures/thesis/<ticker>/<date>.json`) güncellenir

Detay: [`demo.md`](demo.md) §2.
