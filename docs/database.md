# Persistence — PostgreSQL + pgvector + Redis + Fixture Store

> Veritabanı şemaları, Redis key naming convention'ı, fixture disk layout'u ve migration politikası. **"Veri nerede, nasıl saklanır, nasıl sorgulanır"** sorularının tek truth file'ı.
>
> İlgili: [`architecture.md`](architecture.md) §3.5 (persistence layer) · [`data.md`](data.md) §8 (TTL tablosu) · [`agents.md`](agents.md) §4 (tool_call_logs şeması)

---

## 1. PostgreSQL Şeması

### 1.1 Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector
```

Supabase free tier'da pgvector pre-installed.

### 1.2 Tablolar

#### `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','b2b')),
  user_mode TEXT NOT NULL DEFAULT 'default' CHECK (user_mode IN ('default','conservative')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- `user_mode` Conservative Mode persistence ([`agents.md`](agents.md) §5). Ali Bey persona → `conservative`.
- `tier` v2 B2B için hazır, hackathon'da hep `free`.

#### `watchlist`

```sql
CREATE TABLE watchlist (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);
```

Composite PK → aynı kullanıcı aynı hisseyi iki kez ekleyemez.

#### `theses` (ana iş tablosu)

```sql
CREATE TABLE theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  squad TEXT NOT NULL,
  user_mode TEXT NOT NULL,
  thesis_date TIMESTAMPTZ DEFAULT now(),
  thesis_md TEXT NOT NULL,
  bull_points JSONB,
  bear_points JSONB,
  catalysts JSONB,
  confidence FLOAT,
  confidence_breakdown JSONB,
  embedding VECTOR(768),
  price_at_thesis NUMERIC,
  price_7d NUMERIC,
  price_30d NUMERIC,
  price_90d NUMERIC,
  ground_truth_return FLOAT,
  outcome TEXT CHECK (outcome IN ('correct','partial','wrong','pending')) DEFAULT 'pending',
  had_kaynaksiz_flag BOOLEAN DEFAULT false
);

CREATE INDEX idx_theses_embedding ON theses USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_theses_ticker_date ON theses (ticker, thesis_date DESC);
```

**Önemli alanlar:**

- `embedding VECTOR(768)` — text-embedding-3-large 768-dim, `theses` ve `thesis_embeddings` ayrı tablo değil, **inline** (JOIN kaçırır).
- `confidence_breakdown JSONB` — [`agents.md`](agents.md) §6 formülünün her bileşeni: `{data_quality: 80, technical: 65, ...}`
- `price_7d / 30d / 90d` — gece cron'un dolduracağı boş alanlar (NULL allowed).
- `ground_truth_return` — `outcome = pending → correct/partial/wrong` transition'ında hesaplanır.
- `had_kaynaksiz_flag` — UI'da turuncu rozet için; istatistik için (sistem güveni metriği).

**İndeksler:**

- `idx_theses_embedding` ivfflat cosine — Memory similarity (top_k=3) için.
- `idx_theses_ticker_date` — "ASELS son tezleri" hızlı sorgu.

#### `tool_call_logs` (citation kaynağı)

```sql
CREATE TABLE tool_call_logs (
  call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args JSONB,
  result JSONB,
  latency_ms INT,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tool_call_logs_thesis ON tool_call_logs (thesis_id);
```

- **`call_id` UUID** → Citation enforcement'ın anchor'ı. Synthesizer `[kaynak: <call_id>]` etiketiyle bu ID'ye bağlar.
- `result JSONB` — provider'dan gelen ham payload (audit + replay için).
- `latency_ms` — observability ([`testing.md`](testing.md) §2).
- ON DELETE CASCADE — tez silinince tüm tool log'ları da gider.

#### `citations` (synthesizer claim → tool_call mapping)

```sql
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  call_id UUID REFERENCES tool_call_logs(call_id),
  is_kaynaksiz BOOLEAN DEFAULT false
);
```

- Synthesizer validate'ten sonra her cümle bir satır.
- `is_kaynaksiz = true` → soft flag (1-retry sonrası başarısız).
- UI tooltip için: hover → `claim_text`'in `call_id`'sinin `tool_call_logs.result`'unu göster.

### 1.3 İlişki Diyagramı

```
users ──┬── watchlist
        └── theses ──┬── tool_call_logs ──┐
                     └── citations ───────┘
                              (call_id FK)
```

### 1.4 Migration Politikası

- **Alembic** — `backend/migrations/`. Her şema değişikliği yeni migration dosyası.
- İlk migration: yukarıdaki 5 tablo + 2 index.
- Production'da `alembic upgrade head` deploy script'inde.
- Hackathon: Supabase'de manuel SQL koşmak yerine alembic disiplini → 3 kişi tutarlı.

---

## 2. Redis Key Şeması

| Pattern | TTL | İçerik | Üreten |
|---|---|---|---|
| `macro:context` | 15 dk | JSON makro paragraf | Macro Context Agent |
| `macro:bist` | 15 dk | BIST endeks state | Macro Context |
| `price:<TICKER>:ohlcv:90d` | 15 dk | DataFrame JSON | Technical Worker |
| `price:<INDEX>:ohlcv:90d` | 15 dk | Endeks (XU100) | Technical Worker |
| `fin:<TICKER>:<Q>` | 24 saat | Financial statements (IFRS) | Fundamental Worker |
| `kap:<TICKER>:filings:30d` | 1 saat | KAP filings array | Fundamental Worker |
| `analyst:<TICKER>` | 24 saat | Analist tavsiyesi | Fundamental Worker |
| `peers:<SQUAD>` | 24 saat | Peer scanner sonuç | Fundamental Worker |
| `dividend:<TICKER>` | 24 saat | Temettü geçmişi | Fundamental Worker |
| `news:<TICKER>` | 1 saat | Hisse haberi | News scrape (Synthesizer context) |
| `news:macro` | 1 saat | Makro haber | Macro Context |
| `demo:warm:<TICKER>` | ∞ (demo süresi) | Pre-warmed full thesis | `scripts/warmup.py` |
| `agent:state:<session_id>` | session boyu | Strands agent state | Orchestrator |
| `ws:channel:<user_id>` | bağlantı boyu | WebSocket pub/sub channel | FastAPI |
| `ratelimit:gemini:<minute>` | 60 sn | Gemini RPM counter | Orchestrator pre-check |

**Naming convention:** `<domain>:<entity>:<modifier>`. Hep küçük harf, `:` separator. TICKER büyük harf (BIST standardı: `ASELS`, `GARAN`).

**Invalidation politikası:**

- Çoğu key TTL-based (natural expire).
- Demo pre-warm key'leri `∞` → `scripts/refresh_fixtures.py` öncesi manuel `DEL`.
- KAP webhook (v2): yeni filing geldiğinde `kap:<TICKER>:filings:30d` invalidate.

**Cluster davranışı:** Upstash serverless → cluster yok, tek node. Hackathon scope için yeterli.

---

## 3. Fixture Store (Disk)

```
fixtures/
├── price/
│   ├── ASELS.json         # Son 90 gün OHLCV
│   └── TUPRS.json
├── kap/
│   ├── ASELS.json         # Son 30 gün filings
│   └── ...
├── fin/
│   ├── ASELS/
│   │   ├── Q1.json
│   │   ├── Q2.json
│   │   └── Q3.json
│   └── ...
├── analyst/
│   └── <TICKER>.json
├── peers/
│   └── <SQUAD>.json
├── news/
│   └── <TICKER>.json
├── macro/
│   └── latest.json
└── thesis/                # Demo kill-switch için pre-baked tez
    ├── ASELS/2026-05-12.json
    ├── TUPRS/2026-05-12.json
    └── ...
```

### 3.1 Dosya Formatı

```json
{
  "key": "price:ASELS:ohlcv:90d",
  "provider": "yfinance",
  "fetched_at": "2026-05-12T09:30:00Z",
  "ttl_hours": 48,
  "payload": { ... }
}
```

- `provider` — hangi DataProvider üretti (audit için).
- `ttl_hours = 48` — 48 saat sonra stale kabul edilir, refresh önerilir.
- `payload` — provider'ın ham çıktısı.

### 3.2 Fixture Writer

Her başarılı `ChainedDataProvider.fetch()` sonrası (demo mode değilse) snapshot yazılır. Kod: [`data.md`](data.md) §5.2.

### 3.3 Demo Refresh

`scripts/refresh_fixtures.py` — demo'dan 24 saat önce çalıştır. 10 pre-warm hisse için tüm fixture'ları taze hale getirir. Liste: [`demo.md`](demo.md) §2.

### 3.4 Backup

Fixture'lar backend container disk'inde. Container yeniden deploy'da kaybolur — `scripts/refresh_fixtures.py` yeniden doldurur. Production v2: S3'e replicate.

---

## 4. Sorgu Örnekleri

### 4.1 Memory Similarity (Synthesizer öncesi)

```sql
SELECT id, ticker, thesis_date, thesis_md, outcome, ground_truth_return,
       embedding <=> $1::vector AS distance
FROM theses
WHERE ticker = $2 OR squad = $3
ORDER BY embedding <=> $1::vector
LIMIT 3;
```

- `$1` — yeni sorgu embedding (768-dim)
- `$2` — current ticker
- `$3` — current squad
- `<=>` — cosine distance (pgvector operator)

### 4.2 Tezin Tüm Citation'ları (UI tooltip)

```sql
SELECT c.claim_text, c.is_kaynaksiz,
       t.tool_name, t.agent_id, t.args, t.result
FROM citations c
LEFT JOIN tool_call_logs t ON c.call_id = t.call_id
WHERE c.thesis_id = $1
ORDER BY c.id;
```

### 4.3 Gece Cron — Outcome Update

```sql
UPDATE theses
SET price_7d = $1, price_30d = $2, price_90d = $3,
    ground_truth_return = $4,
    outcome = $5
WHERE id = $6 AND outcome = 'pending';
```

Akış: [`flows.md`](flows.md) §4.

---

## 5. Lokal Geliştirme

`docker-compose.yml` ile:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: thesisforge
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

Detay: [`stack.md`](stack.md) §5.
