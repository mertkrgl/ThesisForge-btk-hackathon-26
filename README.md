# ThesisForge

**Türkiye retail yatırımcısı için multi-agent AI yatırım tezi üreticisi.**

> Profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan AI sistemi. Bir borsa botu değildir — **tez üreticidir**.

---

## 30 Saniyede Proje

6 milyondan fazla Türk bireysel yatırımcı bir hisseyi araştırırken sosyal medyaya, YouTube hocalarına veya tek bir aracı kurum raporuna güvenmek zorunda. ThesisForge bunun yerine **8 farklı ajan**ın aynı hisseye farklı açılardan baktığı bir komite süreci modelliyor: Technical Worker pandas-ta ile teknik analizi yapar, Fundamental Worker MKK API + isyatirim ile finansalları okur, Devil's Advocate her şeyi sorgular, Synthesizer dengeli bir bull/bear/catalyst tezi üretir. Her sayı kaynağına bağlı (citation-grounded), sistem geçmiş tezleri hatırlar (memory + pgvector), kararı kullanıcı verir.

---

## Belgeler

📘 **Kuş bakışı:** [`BLUEPRINT.md`](BLUEPRINT.md) — proje portal'ı, her modül için özet + link.

📁 **Modül detayları:** [`docs/`](docs/)

| Modül | Dosya |
|---|---|
| Ürün vizyonu, personalar | [`docs/product.md`](docs/product.md) |
| Sistem mimarisi | [`docs/architecture.md`](docs/architecture.md) |
| 8 ajan, squad, citation | [`docs/agents.md`](docs/agents.md) |
| Veri kaynakları | [`docs/data.md`](docs/data.md) |
| Veritabanı şemaları | [`docs/database.md`](docs/database.md) |
| Sequence + kill-switch | [`docs/flows.md`](docs/flows.md) |
| Tech stack + deploy | [`docs/stack.md`](docs/stack.md) |
| 7 günlük sprint | [`docs/sprint.md`](docs/sprint.md) |
| Test + observability | [`docs/testing.md`](docs/testing.md) |
| Riskler + kararlar | [`docs/risks.md`](docs/risks.md) |
| Demo senaryoları | [`docs/demo.md`](docs/demo.md) |
| v2 roadmap | [`docs/roadmap.md`](docs/roadmap.md) |

🗄️ **Eski planlama notları:** [`archive/`](archive/) — v1 planlama (referans). Çelişki halinde `docs/` geçerlidir.

---

## Hızlı Başlangıç

> İmplementasyon Sprint Gün 1'de başlayacak. Aşağıdaki komutlar Gün 1 sonunda çalışır olacak.

```bash
# Backend + Frontend + Postgres + Redis tek komutla
docker compose up

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# Postgres: localhost:5432 (thesisforge/dev)
# Redis: localhost:6379
```

Detaylı kurulum: [`docs/stack.md`](docs/stack.md) §5.

---

## Takım

| Rol | Sorumluluk | Ana dosyalar |
|---|---|---|
| **A — Agent Lead** | Backend ajanlar, LLM, Synthesizer, Devil's, citation | [`docs/agents.md`](docs/agents.md), [`docs/flows.md`](docs/flows.md) |
| **B — Data/DevOps Lead** | Veri, persistence, Docker, CI/CD | [`docs/data.md`](docs/data.md), [`docs/database.md`](docs/database.md) |
| **C — Frontend Lead** | UI/UX, demo | [`docs/stack.md`](docs/stack.md), [`docs/demo.md`](docs/demo.md) |

Sprint planı: [`docs/sprint.md`](docs/sprint.md).

---

## Lisans ve Atıf

Bu proje BTK 2026 Hackathon kapsamında geliştirilmiştir. Kullanılan açık kaynak kütüphaneler:

- `yfinance` (Apache 2.0)
- `pandas-ta`, `isyatirimhisse`, `borsapy` (MIT)
- `strands-agents`, `fastapi`, `next.js` (MIT/Apache)

Inspiration: [`borsa-mcp`](https://github.com/saidsurucu/borsa-mcp) — referans olarak okundu, kod kopyalanmadı.

Tam atıf listesi: [`docs/data.md`](docs/data.md) §10.

---

## Disclaimer

ThesisForge **bilgi sunumu ve eğitim aracıdır**. **Yatırım tavsiyesi değildir** (SPK lisansı dışı). Yatırım kararları için lisanslı bir danışmana başvurun. Her tezde zorunlu disclaimer bulunur.
