# Archive — Eski Planlama Notları

Bu klasör, projenin **modüler dokümantasyon yapısı (`docs/`)** kurulmadan önceki erken planlama belgelerini içerir. **Tüm geçerli kararlar [`../docs/`](../docs/) altındaki modül dosyalarındadır; üst seviye özet [`../BLUEPRINT.md`](../BLUEPRINT.md)'dedir.** Bu dosyalar yalnızca referans ve git geçmişi açısından korunmaktadır.

## Dosyalar

| Dosya | Durum | İçerik | Modern karşılığı |
|---|---|---|---|
| `Analiz.md` | Süperseded | Ürün vizyonu + mimari + 15 maddelik kritik inceleme (1385 satır) | [`../docs/product.md`](../docs/product.md) + [`../docs/architecture.md`](../docs/architecture.md) |
| `FLOW.md` | Süperseded | Sequence diagram + cache stratejisi + senaryolar (504 satır) | [`../docs/flows.md`](../docs/flows.md) |
| `DECISIONS.md` | Süperseded | 15 maddenin finalize edilmiş kararları, 2026-05-10 (250 satır) | [`../docs/risks.md`](../docs/risks.md) §2 |
| `SPRINT.md` | Süperseded | 7 günlük plan, 3 kişi, gün-gün görev (240 satır) | [`../docs/sprint.md`](../docs/sprint.md) |
| `Rapor.md` | **ESKİ — geçersiz** | İlk öneri raporu. ChromaDB, 9 ajan gibi geçersiz kılınmış kararları içerir. | — (yok) |
| `prompt.md` | **ESKİ — geçersiz** | Orijinal proje brief'i. Erken kararlar bu dosyada. | — (yok) |
| `DEXTER_ANALIZ.md` | Referans | github.com/virattt/dexter analizi — sadece ilham, projeye dahil değil. | — (yok) |

## Uyarı

Bu klasördeki herhangi bir dosyada `docs/` veya `BLUEPRINT.md` ile çelişen bir bilgi görürseniz, **`docs/<modül>.md` doğru olandır.** BLUEPRINT.md genel özet, `docs/` modül-detay; ikisi tutarlı tutulur.
