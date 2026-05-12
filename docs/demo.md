# Demo Stratejisi

> Üç sunum senaryosu, pre-warm hisse listesi, kill-switch operatör kontrolü, video kayıt scripti ve submission checklist. **"Sunum nasıl gidecek"** sorusunun tek truth file'ı.
>
> İlgili: [`product.md`](product.md) §4 (personalar) · [`flows.md`](flows.md) §6 (kill-switch) · [`sprint.md`](sprint.md) Gün 7

---

## 1. Üç Sunum Senaryosu

### 1.1 Senaryo 1 — Mehmet (default mode) — ASELS

**Persona:** [`product.md`](product.md) §4.1 — 34 yaş mühendis, hobby investor.

**Akış:**
- Watchlist'ten "ASELS analiz et" tıkla
- 8 ajan tam pipeline ([`flows.md`](flows.md) §1)
- Memory: "6 ay önce AL +%18" similarity inject (Senaryo 3 ile birleşik)
- Streaming Markdown (token-by-token, WebSocket)
- Citation tooltip hover → ilgili tool çağrısı görünür

**Süre:** ~52s canlı (pre-warm cache yoksa). Demo'da pre-warm aktifse <8s.

**Anlatım odağı:** "Sistem 8 ajan kullanıyor, hepsi farklı uzmanlık alanı. Her sayı kaynağına bağlı — burada hover edersem KAP filing'in tam metnini görüyorum."

### 1.2 Senaryo 2 — Ali Bey (conservative mode) — TUPRS

**Persona:** [`product.md`](product.md) §4.3 — 56 yaş emekli, temettü hissesi arayan.

**Akış:**
- Aynı pipeline + `user_mode=conservative`
- Bear case başa, confidence cap=70, temettü vurgulu ([`agents.md`](agents.md) §5)
- "Bu hisse muhafazakar profil için uygun mu?" özet cümlesi sonda

**Süre:** ~48s.

**Anlatım odağı:** "Aynı veriler, aynı ajan komitesi, ama farklı **persona** — sistem riski daha öne çıkarıyor. Bu Ali Bey'in 'sermayemi yakmayayım' korkusuna doğrudan cevap."

### 1.3 Senaryo 3 — Memory Similarity Wow-Factor

**Persona:** Mehmet veya Zeynep ([`product.md`](product.md) §4.1, §4.2).

**Setup:**
- Demo'dan 6 ay önce yazılmış sahte tez DB'ye seed edilmiş (`outcome=correct`, `actual_return=+18%`)
- Sahte tez içeriği gerçekçi — "ASELS Q1'26 backlog büyümesi + USD revenue artışı..."

**Akış:**
- Yeni sorgu → Memory Agent similarity hit → Synthesizer prompt'una inject
- Tez içinde "Tarihsel Bağlam" bölümü:
  > "Bu hisse için 6 ay önce şu tez yazılmıştı: '... AL'. Gerçekleşen: +%18 (correct). Mevcut katalizörler benzer mi farklı mı analiz ediliyor."

**Anlatım odağı:** "Sistem **kendi geçmişini hatırlıyor**. Bu sadece güzel görsel değil — geçmiş tezlerin gerçekleşen getirisi confidence skoruna giriyor. ChatGPT'de yok, robo-advisor'da yok."

---

## 2. Pre-Warmed Cache Listesi

Demo 24 saat öncesinden `scripts/warmup.py` ile doldurulan **10 hisse**:

```
ASELS, GARAN, TUPRS, BIMAS, EREGL,
THYAO, AKBNK, KCHOL, SISE, ULKER
```

**Squad dağılımı:**
- Banking: GARAN, AKBNK
- Energy: TUPRS, EREGL (mix)
- Defense: ASELS
- Retail: BIMAS, ULKER, SISE
- Holding: KCHOL
- Diğer: THYAO

Her hisse için ne dolduruluyor:

| Hedef | TTL | Niye |
|---|---|---|
| `price:<T>:ohlcv:90d` Redis | 15 dk → demo süresi | Technical Worker hızlı |
| `kap:<T>:filings:30d` Redis | 1 saat → demo süresi | Fundamental Worker hızlı |
| `demo:warm:<T>` Redis (tam tez Markdown) | ∞ (demo süresi) | Sunum aşaması <8s |
| `fixtures/thesis/<T>/<date>.json` disk | 48 saat | Kill-switch fallback |

Script çağrı sırası ([`sprint.md`](sprint.md) §6):
1. `python scripts/refresh_fixtures.py`
2. `python scripts/warmup.py`
3. Smoke test 3 hisse
4. Kill-switch fixture kontrol

---

## 3. Kill-Switch Operatör Kontrolü

**Demo operator rolü:** Sunum sırasında 1 ekip üyesi laptop'ta hazır bekler.

**Manuel tetik:** Sunum URL'ine `?force_demo=1` query param ekle → kill-switch açık → tüm tezler `fixtures/thesis/` üzerinden.

**Otomatik tetikleyiciler:**
- Pipeline >90s
- 3 ardışık tool fail
- Gemini 429 (rate limit)

**UI davranışı:** Kill-switch aktifken sağ üstte **küçük "⚠️ Demo modu — önceden üretilmiş tez"** rozeti gösterilir. Sunucu dürüstlük için saklamaz.

Akış: [`flows.md`](flows.md) §6.

---

## 4. Video Kayıt Scripti (3-5 dk)

| Dakika | İçerik |
|---|---|
| 0:00–0:30 | **Problem:** Türkiye retail yatırımcı tablosu (6M hesap, %80 yeni). Görsel + tek cümle hook. |
| 0:30–1:00 | **ThesisForge tanıtımı:** "Yatırım komitesinin cebinde" pitch + "ne değil" tablosu ([`product.md`](product.md) §3). |
| 1:00–2:15 | **Senaryo 1: Mehmet ASELS** — canlı stream, citation tooltip hover, bull/bear collapsible. |
| 2:15–3:15 | **Senaryo 2: Ali Bey TUPRS** — conservative mode farkı (bear başta), "muhafazakar uygun mu" özeti. |
| 3:15–4:00 | **Senaryo 3: Memory similarity** — 6 ay önce ASELS tezi inject, "sistem kendi geçmişini hatırlıyor" anlatımı. |
| 4:00–4:30 | **Mimari özet:** 8 ajan diagram, Pro/Flash split, citation-grounded 4-katman, kill-switch. |
| 4:30–5:00 | **Tech stack + sprint + v2 roadmap teaser** ([`stack.md`](stack.md), [`sprint.md`](sprint.md), [`roadmap.md`](roadmap.md)). |
| 5:00 | Disclaimer + ekip + GitHub link. |

**Kayıt önerisi:** Loom veya OBS, 1080p, sistem sesi açık (typing tıklama), ekran tek pencere.

---

## 5. Submission Checklist

- [ ] **GitHub repo public** + güncel `README.md` ([README](../README.md))
- [ ] **Demo video link** (YouTube/Drive, unlisted veya public)
- [ ] **Canlı demo URL** (Vercel + Railway/Fly.io) test edildi
- [ ] **Sunum slide (PDF)** — mimari + 3 senaryo + tech stack + roadmap
- [ ] **`BLUEPRINT.md`** + `docs/` index linkleri çalışıyor
- [ ] **Submission formu** doldu (BTK 26)
- [ ] **`.env` repo'da DEĞİL**, `.env.example` var
- [ ] Disclaimer her tez sayfasında görünüyor (regülasyon)
- [ ] Lisans + atıf (`borsapy`, `isyatirimhisse`, `borsa-mcp inspiration`) — [`data.md`](data.md) §10

---

## 6. Sunum Anında Backup Planlar

| Senaryo | Backup |
|---|---|
| Internet kopması | Lokal docker-compose ile çalışan kopya — backup laptop |
| Demo URL deploy down | Lokal demo + ekran paylaşımı |
| Gemini 429 | Kill-switch otomatik → pre-baked tez |
| BIST kapalı (akşam demo) | Pre-warm cache zaten dolu — fark edilmez |
| Mikrofon arıza | Yedek headset |

**Genel kural:** Demo başlamadan 30 dk önce **tam dry run** — A canlı pipeline, B production smoke test, C UI gözden geçirme.
