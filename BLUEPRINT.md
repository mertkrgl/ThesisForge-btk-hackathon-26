# ThesisForge — Proje Blueprint'i

> **Bu dosya proje dokümantasyonunun portal'ıdır.** Her bölüm için 1-2 paragraf özet + ilgili detay dosyasına link. **Çelişki halinde `docs/<modül>.md` geçerlidir.**
>
> Son güncelleme: 2026-05-12 · Sürüm: 2.0 (modüler yapı) · 7 gün / 3 kişi hackathon scope

---

## Tek Cümle

ThesisForge, profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan **multi-agent AI karar destek sistemidir** — bir borsa botu değildir, **tez üretici**dir.

---

## Hızlı Erişim Tablosu

| Konu | Detay | İlgili Rol |
|---|---|---|
| Ürün vizyonu, problem, personalar, rakipler | [`docs/product.md`](docs/product.md) | herkes |
| Sistem mimarisi, 4 katman, Strands | [`docs/architecture.md`](docs/architecture.md) | A, B |
| 8 ajan + 17+1 squad + citation + conservative + güven skoru | [`docs/agents.md`](docs/agents.md) | A |
| Veri kaynakları + provider chain + onboarding | [`docs/data.md`](docs/data.md) | B |
| Postgres + pgvector + Redis + fixture | [`docs/database.md`](docs/database.md) | B |
| Sequence diagram, cache, citation, memory, kill-switch | [`docs/flows.md`](docs/flows.md) | A, C |
| Backend + frontend + deploy + maliyet | [`docs/stack.md`](docs/stack.md) | herkes |
| 7 günlük sprint planı, daily ritüel, bağımlılık | [`docs/sprint.md`](docs/sprint.md) | herkes |
| Test stratejisi + observability + metrikler | [`docs/testing.md`](docs/testing.md) | A, B |
| Risk tablosu + tasarım kararları | [`docs/risks.md`](docs/risks.md) | herkes |
| Sunum 3 senaryosu + pre-warm + video script | [`docs/demo.md`](docs/demo.md) | C |
| v2 roadmap | [`docs/roadmap.md`](docs/roadmap.md) | — |

---

## Modül Özetleri

### Ürün

ThesisForge bilgi sunumu ve eğitim aracıdır (SPK lisans dışı). 4 persona için tasarlanmış: Mehmet (hobby investor), Zeynep (junior analyst), Ali Bey (conservative saver), Junior PM (B2B v2). Diferansiyatör 3'lü kombinasyon: multi-agent komite süreci + her sayıya bağlı citation + geçmiş tezleri hatırlayan memory. Bu kombinasyon piyasada yok.

👉 [`docs/product.md`](docs/product.md)

### Mimari

4 katman: Presentation (Next.js 15 PWA) → Application (FastAPI + Strands) → Agent & Data (8 ajan + DataProvider chain) → Persistence (Postgres + pgvector + Redis + fixture disk). Orkestrasyon: 3-bacak paralel (Router + Macro + Memory) → 2 Worker paralel (Technical + Fundamental) → Devil's Advocate → Synthesizer → Citation validate → DB persist. Toplam ~52s realistic, pre-warm <8s.

👉 [`docs/architecture.md`](docs/architecture.md)

### Ajanlar

8 ajan: Macro Context, Orchestrator, Sector Router, Technical Worker, Fundamental Worker, **Devil's Advocate (Pro)**, **Synthesizer (Pro)**, Memory Agent. Pro x2 (kalite) + Flash x6 (maliyet). 17+1 sektör squad (Banking, Insurance, Finance, Brokerage, RealEstate, Energy, Defense, Automotive, Technology, Healthcare, Food, Retail, Construction, Industrial, Mining, Transportation, Holding, Generic — `backend/sector_map.yaml` 893 tickerı kapsar). **Citation-grounded 4 katmanlı halüsinasyon savunması:** tool provenance + structured output + ID-bazlı validate + numeric sanity. **Conservative mode:** bear başa, confidence ≤70, temettü vurgulu. Sentiment Worker ve Backtest Validator v2'ye.

👉 [`docs/agents.md`](docs/agents.md)

### Veri Katmanı

**Resmi primary kaynaklar:** TCMB EVDS (makro) + MKK API Portal (KAP bildirim, 12 servis, ücretsiz REST). **Yarı-resmi:** isyatirimhisse (BIST + IFRS finansal tablo) + borsapy (analist tavsiyesi + scanner). **Secondary:** yfinance, KAP RSS, Mynet/Bigpara scrape. `DataProvider` interface arkasında **üç-seviyeli fallback** (primary → secondary → fixture). Agent registry üzerinden çağırır, doğrudan HTTP yapmaz. Test/demo mode tek bayrakla açılır.

👉 [`docs/data.md`](docs/data.md)

### Veritabanı

PostgreSQL 5 tablo: `users`, `watchlist`, `theses` (embedding 768-dim inline), `tool_call_logs` (citation anchor), `citations`. pgvector ivfflat cosine index Memory similarity için. Redis 15 key pattern, TTL'li (15dk-24h). Fixture disk: `fixtures/<domain>/<key>.json` 48 saat snapshot. Alembic migration.

👉 [`docs/database.md`](docs/database.md)

### Akışlar

Uçtan uca sequence (Mehmet ASELS, ~52s), cache stratejisi, citation enforcement (1-retry + soft flag), memory read/write + gece cron (02:00 UTC outcome update), conservative mode akışı, demo kill-switch (90s timeout veya 3 fail → fixture tez), senaryo karşılaştırması.

👉 [`docs/flows.md`](docs/flows.md)

### Tech Stack

**Backend:** Python 3.11, FastAPI, Strands, google-generativeai, yfinance + isyatirimhisse + borsapy + pandas-ta, httpx, SQLAlchemy + alembic + pgvector, redis-py, OpenTelemetry, structlog. **Frontend:** Next.js 15, React 19, Tailwind, shadcn/ui, recharts. **Deploy:** Railway/Fly (backend), Vercel (frontend), Supabase (Postgres+pgvector), Upstash (Redis). Hackathon maliyet $10-20.

👉 [`docs/stack.md`](docs/stack.md)

### Sprint

3 kişi (A=Agent Lead, B=Data/DevOps Lead, C=Frontend Lead), 7 gün. **Gün 1:** repo + Gemini + TCMB + MKK API kayıt (sabah 09:00). **Gün 2:** Macro Agent + DataProvider chain + sector_map. **Gün 3:** Sector Router + 2 Worker paralel. **🎯 Gün 4 MVP:** Devil's + Synthesizer + Citation. **Gün 5:** WebSocket + Memory similarity. **Gün 6:** Conservative + Tests + Kill-switch + Deploy. **Gün 7:** Demo + Video + Submission. Daily ritüel: 09:00 standup, 18:00 dry run.

👉 [`docs/sprint.md`](docs/sprint.md)

### Test ve Gözlemlenebilirlik

Unit testler kritik path'lerde >%70 coverage (validate_citations, sector_router, compute_ratios, chained_provider, memory similarity, confidence_score). Integration tests mock LLM ile e2e + memory round-trip + citation loop. Smoke tests gerçek LLM ile 5 hisse nightly. CI: GitHub Actions PR (unit+integration) + nightly (smoke). OpenTelemetry trace + structlog JSON + 7 metrik.

👉 [`docs/testing.md`](docs/testing.md)

### Riskler ve Tasarım Kararları

15 risk tablosu (KAP, yfinance, Gemini rate limit, MKK onay gecikme, IP-ban, sunum çökmesi, vb.) + 15 finalize edilmiş tasarım kararı (pgvector, Pro/Flash split, conservative mode, citation 1-retry, pandas-ta, 17+1 squad MKK-bazlı, MKK primary, vb.). Mimari kümülatif etki: 10→8 ajan, 3→2 paralel worker.

👉 [`docs/risks.md`](docs/risks.md)

### Demo

**Senaryo 1:** Mehmet ASELS default streaming. **Senaryo 2:** Ali Bey TUPRS conservative (bear başta). **Senaryo 3:** Memory similarity (6 ay önce tez +%18 inject). 10 hisse pre-warm cache (ASELS, GARAN, TUPRS, BIMAS, EREGL, THYAO, AKBNK, KCHOL, SISE, ULKER). Kill-switch operatör `?force_demo=1` query param. Video 3-5 dk scripted.

👉 [`docs/demo.md`](docs/demo.md)

### v2 Roadmap

Sentiment Worker (Reddit/Ekşi/Telegram), Backtest Validator (as-of-date), True A2A protocol, Multi-user B2B white-label, Mobile native, Premium data layer (Foreks/Matriks/VERDA), Sosyal özellikler (topluluk skorboard).

👉 [`docs/roadmap.md`](docs/roadmap.md)

---

## Dokümantasyon Politikası

- **Tek değişiklik tek modül dosyasında.** BLUEPRINT.md'yi sadece "yeni modül eklenince" veya "özet yenilenince" güncelle.
- **`archive/` dokunulmaz tarihsel referans.** Erken planlama notları (`Analiz.md`, `FLOW.md`, `DECISIONS.md`, `SPRINT.md`) v1 referansı; içerikleri uygun şekilde `docs/` altında konsolide edildi. `Rapor.md`, `prompt.md`, `DEXTER_ANALIZ.md` artık geçersiz.
- **Çelişki halinde** `docs/<modül>.md` doğrudur, BLUEPRINT.md güncellenir.
- Yeni geliştirici onboarding: `README.md` → `BLUEPRINT.md` (kuş bakışı) → ilgili `docs/<modül>.md`.

---

## Disclaimer

ThesisForge bilgi sunumu ve eğitim aracıdır. **Yatırım tavsiyesi değildir** (SPK lisansı dışı). Yatırım kararları için lisanslı bir danışmana başvurun. Her tezde zorunlu disclaimer bulunur.
