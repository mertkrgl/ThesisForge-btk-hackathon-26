# Sistem Mimarisi

> Üst seviye sistem mimarisi, katmanlar, orkestrasyon modeli ve teknoloji seçim gerekçeleri. Bu dosya **"sistem nasıl kurulu, ne ne ile konuşuyor"** sorularının tek truth file'ıdır.
>
> İlgili: [`agents.md`](agents.md) (ajan detayları) · [`data.md`](data.md) (provider chain) · [`database.md`](database.md) (persistence) · [`flows.md`](flows.md) (sequence) · [`stack.md`](stack.md) (kütüphaneler)

---

## 1. Üst Seviye Sistem Mimarisi

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
│ • Technical Worker  │        │ • MKK API + KAP RSS  │
│ • Fundamental W.    │        │ • isyatirim + yfin   │
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

**4 katman:** Presentation (Next.js), Application (FastAPI + Strands), Agent & Data (8 ajan + provider chain), Persistence (Postgres + Redis + fixture disk).

---

## 2. Orkestrasyon Modeli (Strands)

| Bölüm | Pattern | Sebep |
|---|---|---|
| Sector Router → Worker seçimi | Graph | Koşullu dallanma (sektöre göre squad) |
| Technical + Fundamental | Agent-as-Tool (Parallel) | Bağımsız çalışırlar |
| Devil's Advocate → Workers | Tool fallback (basit feedback loop) | A2A protocol olgun değil → Agent-as-Tool ile feedback loop |
| Synthesizer | Tek ajan + Structured Output | Deterministik markdown çıktı |
| Memory | Tool call | Stateless DB sorgusu |

**Execution model:**

1. Orchestrator → **3-bacak paralel** (Sector Router + Macro Context + Memory similarity)
2. → **2 Worker paralel** (Technical + Fundamental)
3. → Devil's Advocate (sequential, worker output ister)
4. → Synthesizer (sequential, tüm input)
5. → Citation Validator (1-retry)
6. → DB persist + Memory write (async)

**Toplam beklenen süre:** **40–60 saniye** (realistic). Pre-warmed cache ile <8 saniye. Sequence detayı: [`flows.md`](flows.md) §1.

---

## 3. Katmanlar Detayı

### 3.1 Presentation Layer — Next.js 15 (PWA)

- **Bileşenler:** Watchlist (sol panel), Chat input (alt), Thesis Viewer (ana panel, Markdown stream).
- **Bağlantı:** WebSocket (agent token stream) + REST (CRUD, history). WebSocket kopunca **3 retry exponential backoff → REST polling degrade**. Detay: [`stack.md`](stack.md) §3.
- **State:** Server-driven (FastAPI WebSocket pub/sub). Frontend lokal state minimum — sadece UI durumları.

### 3.2 Application Layer — FastAPI + Strands

- **FastAPI** async-native, WebSocket native. Tek backend container.
- **Strands** multi-agent orchestrasyon kütüphanesi. Agent-as-Tool + Graph pattern karışımı kullanılıyor (bkz. §2).
- **Routing:** `/chat`, `/ws/thesis/<session>`, `/api/thesis/<id>/status`, `/api/watchlist`, `/api/macro`.

### 3.3 Agent Layer — 8 Ajan

Strands ajanları + tool tanımları. Tam katalog: [`agents.md`](agents.md). Özet:

- **Pro (2):** Devil's Advocate, Synthesizer — kalite kritik
- **Flash (6):** Orchestrator, Macro Context, Sector Router, Technical, Fundamental, Memory — maliyet/hız

### 3.4 Data & Tool Layer

`DataProvider` interface arkasında her kaynak. **Üç-seviyeli fallback** (primary → secondary → fixture). Tam katalog ve modül-kaynak matrisi: [`data.md`](data.md).

Kritik tasarım kararı: **Agent doğrudan HTTP yapmaz**, sadece registry üzerinden provider çağırır. Bu sayede test mode, fixture mode, demo mode tek bayrak değişimiyle açılır.

### 3.5 Persistence Layer

- **PostgreSQL + pgvector** — kullanıcı, watchlist, theses, tool_call_logs, citations, embeddings. Tam şema: [`database.md`](database.md).
- **Redis** — cache + agent state + WebSocket pub/sub. Key şeması: [`database.md`](database.md) §2.
- **Fixture disk store** — `fixtures/<domain>/<key>.json` 48 saat snapshot, demo kill-switch için.

---

## 4. Mimari Karar Gerekçeleri

### 4.1 Neden FastAPI?

- Async-native. Strands `asyncio.gather` ile 3-bacak paralel orkestrasyon doğal.
- WebSocket native (Starlette üzerinden) — extra framework gerekmiyor.
- Pydantic entegrasyonu — structured agent output (citation-grounded mimari) için kritik.
- Python ekosistemi — yfinance, isyatirimhisse, pandas-ta hepsi Python.

### 4.2 Neden PostgreSQL + pgvector (ayrı vector DB değil)?

- Tek DB → tek deploy + tek backup. Pinecone/Weaviate ek servis demek.
- pgvector cosine similarity 768-dim embedding için yeterince hızlı (hackathon scope, 1000 tez bile <100ms).
- `theses` tablosu hem metadata hem embedding tutar — JOIN'siz "benzer tezler + outcome" sorgusu.
- Supabase free tier'da pgvector hazır.

### 4.3 Neden Redis (ek cache değil, hem cache hem pub/sub)?

- WebSocket pub/sub doğal: token stream multiple subscriber'a hızlı yayılır.
- Agent state TTL'li session storage → "kullanıcı 5 dk sonra geri döndüğünde devam edebilir".
- Cache layer (15dk yfinance, 1 saat KAP, 24 saat finansal) — TTL tablosu: [`data.md`](data.md) §8.
- Upstash free tier serverless.

### 4.4 Neden Next.js 15?

- React 19 server components ile başlangıç render hızlı (PWA için kritik).
- WebSocket native + Tailwind + shadcn/ui ekosistemi olgun.
- Vercel free tier deploy 1 komutta.

### 4.5 Neden Strands (LangGraph/CrewAI değil)?

- Agent-as-Tool pattern native → Devil's Advocate'in worker'lara feedback gönderebilmesi için kritik.
- OpenTelemetry native — observability sıfır ek iş.
- Multi-model (Gemini Pro + Flash karışık) tek runner.
- Karar gerekçesi: hackathon scope'unda **stabil** olduğu test edildi (DECISIONS arşivinden).

### 4.6 Neden Gemini (OpenAI/Claude değil)?

- **Maliyet:** Tier 1 paid plan Pro ~$1.25/M input, Flash $0.075/M — hackathon $10-20 bütçe için ideal.
- **Hız:** Flash <1s TTFT, streaming token-by-token native.
- **Türkçe kalite:** Gemini 2.5 Türkçe finans terminolojisinde yeterli (KAP filings, IFRS terimleri).

---

## 5. Veri Akışı Özeti

Tek hisse tezi üretimi (örn. ASELS):

```
User WebSocket bağlantı
  ↓
Orchestrator (Flash) — intent parse + ticker validate
  ↓ paralel ─┬─ Sector Router (Flash) → "Defense Squad"
            ├─ Macro Context (Flash, 15dk cache) → makro paragraf
            └─ Memory Agent → pgvector top_k=3 similarity
  ↓
2 Worker paralel
  ├─ Technical Worker (Flash) — yfinance OHLCV → pandas-ta
  └─ Fundamental Worker (Flash) — MKK API + isyatirim
  ↓
Devil's Advocate (Pro) — worker output sorgular
  ↓
Synthesizer (Pro, streaming) — Markdown tez üretir
  ↓
Citation Validator (1-retry, soft flag)
  ↓
DB persist (theses + tool_call_logs + citations)
  ↓
Memory Agent async write (embedding + pgvector)
```

Detaylı sequence: [`flows.md`](flows.md) §1. Citation enforcement: [`flows.md`](flows.md) §3.
