# ThesisForge Backend — Manuel Test Rehberi

Bu doküman uçtan uca pipeline'ı kendi makinende nasıl ayağa kaldırıp test edeceğini anlatır.

---

## 1. Ön Gereksinimler

| Araç | Versiyon | Kurulum |
|---|---|---|
| Python | 3.12 | sistem |
| Docker + Docker Compose | herhangi yeni | sistem |
| Gemini API key | — | https://aistudio.google.com/apikey (free tier yeterli; Tier 1 billing daha güvenilir) |
| TCMB EVDS key | — | https://evds2.tcmb.gov.tr/ (data probe için, opsiyonel) |
| MKK KAP key | — | KAP üzerinden uygulama anahtarı (opsiyonel) |

Repo root'u: `~/Masaüstü/btk-hackathon'26`
Backend kökü: `~/Masaüstü/btk-hackathon'26/backend`

---

## 2. .env Dosyaları — Nerede ve Ne İçerikle

İki ayrı `.env` dosyası kullanıyoruz. **Her ikisi de gitignored**; gerçek anahtarları asla `.env.example` veya `.env.probe.example` içine koyma.

### 2.1. `backend/.env` — Backend için (zorunlu)

**Yer:** `backend/.env` (yani `~/Masaüstü/btk-hackathon'26/backend/.env`)

`backend/.env.example`'ı kopyalayıp doldur:

```bash
cp backend/.env.example backend/.env
```

Minimum gerekli alanlar:

```env
# ── App
ENV=dev
LOG_LEVEL=INFO
THESISFORGE_MODE=live              # live | fixture
CACHE_BACKEND=memory

# ── DB (docker-compose'daki postgres'i hedefler, port 5433)
DATABASE_URL=postgresql+asyncpg://tf:tf@localhost:5433/thesisforge

# ── LLM (zorunlu)
GEMINI_API_KEY=AIzaSy...           # buraya kendi anahtarın
GEMINI_MODEL_PRO=gemini-2.5-flash  # free tier'da pro=0 quota; pro yerine flash kullan
GEMINI_MODEL_FLASH=gemini-2.5-flash
GEMINI_EMBED_MODEL=gemini-embedding-001
GEMINI_EMBED_DIMENSIONS=768

# ── Data sources (opsiyonel; verilirse KAP/TCMB tool'ları canlı, verilmezse fixture)
TCMB_EVDS_KEY=
MKK_API_KEY=
MKK_API_SECRET=

# ── Rate limits (request/sec) — varsayılanlar yeterli
ISYATIRIM_RATE_PER_SEC=1
YFINANCE_RATE_PER_SEC=2
MKK_RATE_PER_SEC=2
TCMB_RATE_PER_SEC=2
BORSAPY_RATE_PER_SEC=2
```

**Notlar:**
- `GEMINI_API_KEY` boşsa pipeline ayağa kalkar ama her ajan fallback'e düşer (tezler boş üretilir). En azından bu alan dolu olmalı.
- Gemini free tier'da `gemini-2.5-pro` günlük kotası 0; bu yüzden `GEMINI_MODEL_PRO=gemini-2.5-flash` veriyoruz.
- `gemini-2.5-flash` free tier'da **RPM=5, RPD=250**. Paralel pipeline 1 dakika içinde 13-17 LLM call atıyor → 429 alabilirsin. Tier 1 billing açtığında bu sınır ~RPM 1000'e çıkar.

### 2.2. `.env.probe` — Veri probe scriptleri için (opsiyonel)

**Yer:** repo root'unda, yani `~/Masaüstü/btk-hackathon'26/.env.probe` (backend'in dışında).

`scripts/product/config.py` bu yolu hardcoded okuyor; **taşıma**. İçerik:

```env
TCMB_EVDS_KEY=...
MKK_API_KEY=...
MKK_API_SECRET=...
```

Backend tarafı bu dosyayı doğrudan okumaz, ama TCMB/KAP data provider'larını manuel test ediyorsan probe scriptleri buraya bakar.

### 2.3. .env yüklü mü doğrula

```bash
cd backend && source .venv/bin/activate
python -c "from app.core.config import settings; print('GEMINI:', bool(settings.GEMINI_API_KEY), 'TCMB:', bool(settings.TCMB_EVDS_KEY), 'MKK:', bool(settings.MKK_API_KEY), 'DB:', settings.DATABASE_URL[:40])"
```

Beklenen:
```
GEMINI: True TCMB: True MKK: True DB: postgresql+asyncpg://tf:tf@localhost:5
```

---

## 3. İlk Kurulum (sadece bir kere)

```bash
# 1. Repo'ya gir
cd ~/Masaüstü/btk-hackathon\'26

# 2. Python venv
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .

# 3. .env oluştur ve doldur (Section 2.1)
cp .env.example .env
# editor ile aç, GEMINI_API_KEY vs. doldur

# 4. Postgres + pgvector container
cd ..                              # repo root
docker compose up -d postgres
docker ps                          # "Up X seconds (healthy)" görmeli

# 5. Migration
cd backend
alembic upgrade head               # 5 tablo + indexler + pgvector ext
```

---

## 4. Her Test Oturumu

### 4.1. Servisleri başlat

**Terminal 1 — Postgres (zaten açıksa atla):**
```bash
cd ~/Masaüstü/btk-hackathon\'26
docker compose up -d postgres
docker ps | grep thesisforge-postgres    # healthy olmalı
```

**Terminal 2 — Uvicorn API server:**
```bash
cd ~/Masaüstü/btk-hackathon\'26/backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
```

Sağlıklı çıktı:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Server canlı mı kontrol:
```bash
curl -sS http://127.0.0.1:8000/health
# beklenen: {"status":"ok","env":"dev"}
```

### 4.2. Smoke test (önerilen)

**Terminal 3:**
```bash
cd ~/Masaüstü/btk-hackathon\'26/backend
source .venv/bin/activate

# Default mode
python scripts/smoke_test.py ASELS default

# Conservative mode (confidence cap ≤70 + bear-case-first)
python scripts/smoke_test.py GARAN conservative

# Başka ticker
python scripts/smoke_test.py TUPRS default
```

Script 5 bölümde çıktı verir:
1. `/health` ping
2. `POST /chat` → `thesis_id` + `ws_url`
3. WS event stream (timestamp'li `agent_start → stage(...) → token → done`)
4. `GET /api/thesis/{id}` — tam thesis_md + confidence + bull/bear listesi
5. `GET /api/thesis/{id}/citations` — citation tooltip dump

### 4.3. Manuel curl ile test

Smoke script çalıştırmadan da test edebilirsin:

```bash
# 1. Tezi başlat
THESIS=$(curl -sS -X POST localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"ASELS analiz et","mode":"default"}' | jq -r .thesis_id)
echo "Thesis ID: $THESIS"

# 2. WS bağlan (canlı event stream)
#    websocat veya wscat yüklü olmalı: npm i -g wscat
wscat -c "ws://localhost:8000/ws/thesis/$THESIS"
# pipeline bitince Ctrl+C ile çık

# 3. Final tezi al
curl -sS localhost:8000/api/thesis/$THESIS | jq

# 4. Citation tooltip
curl -sS localhost:8000/api/thesis/$THESIS/citations | jq

# 5. Demo mode (Gemini key olmadan bile çalışır — fixture'dan stream)
THESIS=$(curl -sS -X POST localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"ASELS analiz et"}' | jq -r .thesis_id)
wscat -c "ws://localhost:8000/ws/thesis/$THESIS?force_demo=1"
```

### 4.4. Watchlist endpoint'leri

```bash
# Listele
curl -sS localhost:8000/api/watchlist?user_id=00000000-0000-0000-0000-000000000001 | jq

# Ekle
curl -sS -X POST localhost:8000/api/watchlist \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000001","ticker":"ASELS"}'

# Sil
curl -sS -X DELETE "localhost:8000/api/watchlist?user_id=00000000-0000-0000-0000-000000000001&ticker=ASELS"
```

---

## 5. Otomatik Test Suite

```bash
cd ~/Masaüstü/btk-hackathon\'26/backend
source .venv/bin/activate

# Hepsi (61 test, ~30 saniye)
pytest tests/ -v

# Sadece unit (DB + mock, ~3 saniye, hızlı)
pytest tests/unit -v

# Sadece integration (gerçek DB, ~10 saniye)
pytest tests/integration -v

# Tek test
pytest tests/unit/test_workers.py -v -k technical
```

Unit testler Gemini'yi `monkeypatch` ile mock'lar; API key yokken bile yeşil olur.

---

## 6. WS Event Sözlüğü

Smoke test çıktısında veya WS bağlantısında göreceğin event tipleri:

| `type` | Anlam | Payload |
|---|---|---|
| `agent_start` | Pipeline başladı | `agent, thesis_id, ticker, user_mode` |
| `stage` | Aşama geçişi | `stage` (parallel_3_bacak, parallel_workers, devils_advocate, synthesizer, validator) |
| `token` | Markdown chunk | `content` (60-karakter parça) |
| `done` | Pipeline bitti | `thesis_id, confidence, had_kaynaksiz_flag` |
| `error` | Pipeline hatası | `msg` |

---

## 7. Mimari — Hangi Adım Ne Yapıyor

```
POST /chat
  └─ run_thesis(ticker, mode, websocket_emit)
       │
       1. create_thesis_skeleton  (DB INSERT, thesis_id RETURNING)
       2. PARALLEL 3-bacak:
            ├─ sector_router       → squad (Banking/Defense/...)
            ├─ macro_context       → TCMB+FX+Brent makro paragraf
            └─ memory_agent        → benzer geçmiş tezler (pgvector)
       3. PARALLEL 2-worker:
            ├─ technical_worker    → OHLCV + RSI/SMA + S/R + relative strength
            └─ fundamental_worker  → squad'a göre KAP filings + key metrics
       4. devils_advocate          → push-back + risk uyarıları
       5. data_quality = (başarılı tool çağrısı / toplam) * 100
       6. compute_confidence(...)  → ConfidenceBreakdown (spec §12)
       7. synthesizer              → 8-bölüm markdown
       8. validate_citations       → regex + DB lookup, retry 1 kez
       9. extract_structured       → bull/bear/catalysts JSON
      10. update_thesis_synthesis  → DB persist
      11. write_thesis_embedding_async (fire-and-forget)
      12. WS chunked stream → done event
```

Default mode tipik süre: **30-60s** (Tier 1 billing varsa). Free tier'da 429 retry'lar nedeniyle 60-120s'i bulabilir.

---

## 8. Sorun Giderme

| Sorun | Sebep / Çözüm |
|---|---|
| `port 8000 in use` | `pkill -f "uvicorn app.main"` |
| `postgres connection refused` | `docker compose up -d postgres` |
| `migration not found` | `alembic upgrade head` |
| `.env yüklenmiyor` | `python -c "from app.core.config import settings; print(settings.GEMINI_API_KEY[:8])"` ile doğrula. `backend/` dizini içinde mi? |
| `429 RESOURCE_EXHAUSTED` | Gemini RPM=5 free tier limiti. Tier 1 billing aç, veya 1 dakika bekle. |
| Tez "Sentez ajanı çalışamadı" | LLM 429 alıp fallback'e düştü. `data_quality` yine 100 olabilir (tool'lar başarılı) ama markdown boş. |
| `confidence: None`, `bull pts: 0` | Pipeline yarıda kaldı. Server log'larında `pipeline_fail` ara. |
| `had_kaynaksiz_flag: True` | Synthesizer geçersiz `[kaynak: ...]` UUID döndürdü. Şimdilik kabul edilebilir — UUID enjeksiyonu sıradaki iş. |
| Demo modu istiyorum (LLM olmadan) | WS URL'ine `?force_demo=1` ekle: `ws://localhost:8000/ws/thesis/<id>?force_demo=1` |

---

## 9. Servisleri Durdur

```bash
# Uvicorn (Terminal 2'de Ctrl+C, veya başka terminalden)
pkill -f "uvicorn app.main"

# Postgres (gerekirse)
cd ~/Masaüstü/btk-hackathon\'26
docker compose down            # container durur, veri korunur
docker compose down -v         # veri de silinir (dikkat — fresh start için)
```

---

## 10. Hızlı Smoke Senaryoları

| Komut | Beklenen sonuç |
|---|---|
| `python scripts/smoke_test.py ASELS default` | Defense squad, confidence ~30-65, bull > bear |
| `python scripts/smoke_test.py GARAN conservative` | Banking squad, confidence ≤ 70 (cap), bear case markdown'da önce |
| `python scripts/smoke_test.py TUPRS default` | Energy squad, brent fiyatına atıf |
| `python scripts/smoke_test.py MAVI default` | Retail squad, mağaza/inflation odaklı |
| `python scripts/smoke_test.py EREGL default` | Generic squad fallback (metals BIST'te 6 squad'a girmiyor) |
