# Teknoloji Yığını ve Deploy

> Backend/frontend kütüphaneleri, WebSocket reconnect kodu, deploy hedefleri, docker-compose, maliyet tahmini. **"Ne kuracağız, nasıl deploy edeceğiz, ne kadara mal olacak"** sorularının tek truth file'ı.
>
> İlgili: [`architecture.md`](architecture.md) §4 (teknoloji seçim gerekçeleri) · [`database.md`](database.md) §5 (lokal compose) · [`sprint.md`](sprint.md) §1 (gün 1 kurulum)

---

## 1. Backend (Python 3.11+)

`pyproject.toml` özet:

```toml
python = "^3.11"

# Framework
fastapi = "*"               # Async-native, WebSocket
uvicorn = "*"               # ASGI server

# AI
strands-agents = "*"        # Multi-agent orchestration
strands-agents-tools = "*"  # Tool framework
google-generativeai = "*"   # Gemini 2.5 Pro/Flash SDK

# Data providers (detay: docs/data.md §6.4)
yfinance = "*"              # BIST .IS suffix (secondary)
isyatirimhisse = "*"        # BIST primary financial statements
borsapy = "*"               # Analyst rec + scanner
pandas-ta = "*"             # 130+ teknik indikatör (saf Python — TA-Lib değil)
beautifulsoup4 = "*"        # KAP RSS + news scrape
playwright = "*"            # Mynet/Bigpara fallback scrape (Chromium)
httpx = "*"                 # Async HTTP (TCMB EVDS, MKK API)
pandas = "*"
pydantic = "*"              # Schema validation (citation-grounded)

# Persistence
sqlalchemy = "*"
psycopg2-binary = "*"
alembic = "*"               # Migration
redis = "*"
pgvector = "*"

# Observability
opentelemetry-api = "*"
opentelemetry-sdk = "*"
structlog = "*"

# Test
pytest = "*"
pytest-asyncio = "*"
pytest-cov = "*"
```

**Önemli karar — pandas-ta vs TA-Lib:** TA-Lib C extension, Linux'ta kurulum dertli. pandas-ta saf Python, 130+ indikatör, hackathon scope için yeterli.

---

## 2. Frontend (Next.js 15 / React 19)

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "tailwindcss": "*",
    "shadcn/ui": "*",
    "recharts": "*",
    "lucide-react": "*"
  }
}
```

- **shadcn/ui** — copy-paste component'ler, ekosistem standardı.
- **recharts** — confidence breakdown horizontal bar ([`agents.md`](agents.md) §6).
- **lucide-react** — icon set.
- WebSocket: native `WebSocket` API (extra library yok).

---

## 3. WebSocket Reconnect + REST Polling Degrade

3 retry exponential backoff, sonra REST polling:

```typescript
class ResilientThesisClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private maxRetries = 3;
  private pollingTimer: number | null = null;

  connect(sessionId: string) {
    this.ws = new WebSocket(`/ws/thesis/${sessionId}`);
    this.ws.onopen = () => { this.retries = 0; };
    this.ws.onclose = () => this.handleDisconnect(sessionId);
    this.ws.onerror = () => this.handleDisconnect(sessionId);
    this.ws.onmessage = (e) => this.onToken(JSON.parse(e.data));
  }

  private handleDisconnect(sessionId: string) {
    if (this.retries < this.maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      setTimeout(() => { this.retries++; this.connect(sessionId); },
                 1000 * Math.pow(2, this.retries));
    } else {
      // Degrade to REST polling
      this.startPolling(sessionId);
    }
  }

  private startPolling(sessionId: string) {
    this.pollingTimer = setInterval(async () => {
      const res = await fetch(`/api/thesis/${sessionId}/status`);
      const data = await res.json();
      data.new_tokens?.forEach((t: any) => this.onToken(t));
      if (data.done) clearInterval(this.pollingTimer!);
    }, 2000);
  }
}
```

**Backend:** `GET /api/thesis/<id>/status` endpoint'i son token offset'i sonrası tüm token'ları döner. Streaming UX biraz bozulur ama tez yine de tamamlanır.

---

## 4. Deploy Hedefleri

| Bileşen | Servis | Plan | Niye |
|---|---|---|---|
| Backend | Railway veya Fly.io | Free tier Python | Hobi tier yeterli (hackathon traffic) |
| Frontend | Vercel | Next.js hobby | 1 komutta deploy, edge CDN |
| PostgreSQL + pgvector | Supabase | Free tier | pgvector pre-installed, 500MB |
| Redis | Upstash | Free tier serverless | Pay-per-request, idle ücret yok |
| Fixture storage | Disk (backend container) | — | v2: S3 replicate |
| Domain | Vercel default | — | `thesisforge.vercel.app` veya benzeri |

**Secret yönetimi:** Railway/Fly.io env vars + Vercel env vars. `.env.example` repo'da, gerçek `.env` `.gitignore`'da.

---

## 5. Lokal Geliştirme (docker-compose)

`docker-compose.yml`:

```yaml
version: '3.9'

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

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://thesisforge:dev@postgres:5432/thesisforge
      REDIS_URL: redis://redis:6379
    env_file: .env  # GEMINI_API_KEY, TCMB_EVDS_KEY, MKK_API_KEY, OPENAI_API_KEY
    ports: ["8000:8000"]
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports: ["3000:3000"]
    depends_on: [backend]

volumes:
  postgres_data:
```

**Tek komut:** `docker compose up` → tüm servisler ayağa.

---

## 6. Maliyet Tahmini

### 6.1 Hackathon (7 gün)

| Kalem | Maliyet |
|---|---|
| Gemini API (Tier 1 paid, ~1000 tez test) | $10–20 |
| OpenAI embedding (~5000 embed) | <$1 |
| Supabase (PostgreSQL + pgvector) | $0 (free tier) |
| Upstash (Redis) | $0 (free tier) |
| Vercel (Next.js) | $0 (hobby) |
| Railway / Fly.io (FastAPI) | $0 (free tier) |
| TCMB EVDS | $0 (resmi ücretsiz) |
| MKK API | $0 (resmi ücretsiz) |
| yfinance / isyatirim / borsapy / KAP / Mynet / pandas-ta | $0 |
| **Toplam** | **$10–20** |

### 6.2 Üretim (v2 öngörü)

- Foreks lisansı: ₺500-5000/ay (real-time tick data)
- Gemini Pro scale (10k+ tez/ay): $100-200
- Supabase Pro: $25/ay
- Upstash Pro: $10/ay
- Railway scale: $5-50/ay
- **Toplam:** Aylık ~$200-500

Detay: [`roadmap.md`](roadmap.md).

---

## 7. Gerekli Env Vars

`.env.example`:

```bash
# AI
GEMINI_API_KEY=
OPENAI_API_KEY=

# Data
TCMB_EVDS_KEY=
MKK_API_KEY=
TWELVEDATA_KEY=          # opsiyonel

# Persistence
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# App
THESISFORGE_MODE=production  # production | fixture | demo
```

Detay: [`data.md`](data.md) §6 onboarding prosedürleri.
