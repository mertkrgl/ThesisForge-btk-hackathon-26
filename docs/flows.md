# Akışlar — Sequence, Cache, Citation, Memory, Kill-Switch

> Uçtan uca tez üretim sequence diagram'ı, cache stratejisi, citation enforcement loop'u, memory read/write + gece cron, demo kill-switch ve senaryo karşılaştırması. **"Adım adım ne oluyor"** sorusunun tek truth file'ı.
>
> İlgili: [`agents.md`](agents.md) (ajan davranışları) · [`database.md`](database.md) §2 (Redis TTL) · [`data.md`](data.md) §7 (fallback senaryoları)

---

## 1. Uçtan Uca Sequence Diagram

**Senaryo:** Mehmet "ASELS analiz et" yazıyor (default mode, cache miss).

```
0.0s    Kullanıcı: "ASELS analiz et"
0.1s    WebSocket bağlantısı açılır
        UI: "Komite toplanıyor..." animasyonu

0.5s    Orchestrator → 3-bacak PARALEL tetiklenir:
        ├─ Sector Router → "Defense Squad"
        ├─ Macro Context → cache check (15dk fresh) → paragraf
        └─ Memory Agent → similarity (top_k=3, "6 ay önce AL +%18")

2.0s    3 bacak biter, sonuçlar Orchestrator'a düşer
        UI: "Defense Squad seçildi" rozeti + makro paneli dolar

2.5s    Orchestrator 2 Worker'ı PARALEL tetikler:
        ├─ Technical: get_ohlcv → calculate_indicators (pandas-ta) → patterns
        └─ Fundamental: fetch_kap_filings → compute_ratios → peer_compare
        Her tool call UI'ya stream
        UI: 2 kolon, her biri "düşünüyor..."

2.5–20s WORKER'LAR PARALEL ÇALIŞIR (max 5 tool call her biri)
        Tool çıktıları + LLM çıkarımları stream

20s     2 Worker biter. UI: "tamamlandı" rozetleri.

20.5s   Devil's Advocate tetiklenir (Pro)
        Worker output'unu okur, base_rate_check yapar
        UI: "Devil's Advocate sorguluyor..."

20.5–28s CRITIQUE SÜRECİ
        "Technical pattern bozuluyor demiş, base rate ne?"
        critique cümleleri canlı stream

28s     Synthesizer tetiklenir (Pro, streaming)
        Markdown stream başlar (token-by-token, WebSocket push)
        UI: tez canlı yazılır (TL;DR → Bull → Bear → Catalysts...)

28–48s  SYNTHESİZER YAZIYOR

48s     Citation Validator çalışır (ID-bazlı match) — §3
        ✅ Geçerli → DB'ye yaz
        ❌ Geçersiz → 1-retry, Synthesizer'a feedback
                     ❌ Tekrar geçersiz → [KAYNAKSIZ] soft flag

50s     Memory Agent async write (embed + pgvector) — §4

52s     UI: tam tez görünür, indir/paylaş butonu

        Mehmet: "Bear case'i daha detaylı anlat"
        Follow-up: cached output üzerinden 2–5s
```

**Toplam:** ~52 saniye (realistic). Demo pre-warmed cache: **<8 saniye** (Redis hit).

### 1.1 Süre Bütçesi

| Aşama | Süre | Optimize edilebilir mi? |
|---|---|---|
| 3-bacak paralel (Router + Macro + Memory) | 1.5s | Macro cache hit → ~200ms |
| 2-Worker paralel | 17.5s | Cache hit → ~2s |
| Devil's Advocate (Pro) | 7.5s | Hayır (Pro kalite kritik) |
| Synthesizer streaming (Pro) | 20s | TTFT <1s, geri kalan UX'i bozmaz |
| Citation validate + persist | 4s | — |
| **Toplam** | **~52s** | Pre-warm ile **<8s** |

---

## 2. Cache Stratejisi

Tam tablo: [`database.md`](database.md) §2. Özet:

| Kaynak | TTL | Redis Key |
|---|---|---|
| Macro context | 15 dk | `macro:context` |
| OHLCV (90d) | 15 dk | `price:<TICKER>:ohlcv:90d` |
| Finansal tablo | 24 saat | `fin:<TICKER>:<Q>` |
| KAP filings | 1 saat | `kap:<TICKER>:filings:30d` |
| Haber | 1 saat | `news:<TICKER>` |
| Demo pre-warm | ∞ | `demo:warm:<TICKER>` |

**Cache check sırası:**

1. Redis hit → dön
2. Redis miss → DataProvider chain (primary → secondary → fixture)
3. Başarılı sonuç → Redis SET (TTL) + fixture writer
4. Tüm chain fail → `DataUnavailable` exception → Synthesizer "veri eksik" notu

---

## 3. Citation Enforcement Akışı

```
Synthesizer Markdown üretir
        │
        ▼
┌───────────────────────────┐
│ ID-bazlı validate         │
│ Her [kaynak: <call_id>]   │
│ tool_call_logs'ta var mı? │
└──────────┬────────────────┘
           │
       ┌───┴───┐
       │       │
       ▼       ▼
     ✅ Pass  ❌ Fail (1. tur)
       │       │
       │       ▼
       │  Synthesizer'a feedback gönder
       │  ("şu cümlede ID eşleşmedi")
       │       │
       │       ▼
       │  Re-generate → 2. validate
       │       │
       │   ┌───┴───┐
       │   ▼       ▼
       │  ✅ Pass  ❌ Fail (2. tur)
       │   │       │
       │   │       ▼
       │   │   [KAYNAKSIZ] flag eklenir
       │   │   (soft pass)
       ▼   ▼       ▼
       Persist (DB write + Memory async embed)
```

**Soft flag örneği:**
> "ASELS Q3'te %23 büyüdü [kaynak: kap-2024-q3-call-id]. Yeni MILGEM sözleşmesi imzalandı [KAYNAKSIZ — doğrulanamadı]. R&D harcaması artıyor [kaynak: kap-2024-q3-call-id]."

UI'da `[KAYNAKSIZ]` etiketi **turuncu rozetle** gösterilir — kullanıcı doğrulanamayan iddiayı bilinçli olarak görür.

**Politika:** 1-retry + soft flag. Sonsuz döngü yok, deterministik. Detay: [`agents.md`](agents.md) §4.

---

## 4. Memory Read/Write + Gece Cron

### 4.1 Write Akışı (Synthesizer biten tez)

1. Tez metnini **text-embedding-3-large** ile embed (768-dim)
2. `theses` tablosuna yaz: `{ticker, thesis_date, thesis_md, bull_points[], bear_points[], catalysts[], confidence, embedding, price_at_thesis, outcome: 'pending'}`
3. `tool_call_logs` ve `citations` ile foreign key bağla

### 4.2 Read Akışı (Synthesizer öncesi)

1. Yeni sorgu metnini embed et
2. pgvector cosine similarity → top_k=3 (`ticker = current OR squad = current_squad`)
3. Similar theses + outcome stats Synthesizer prompt'una inject:
   > "Bu hisse için 6 ay önce şöyle bir tez yazıldı: ... Outcome: +%18 (correct)."

Sorgu SQL: [`database.md`](database.md) §4.1.

### 4.3 Gece Cron (02:00 UTC)

**Tool:** APScheduler veya `cron` + Python script.

1. `outcome = 'pending'` ve `thesis_date <= now() - INTERVAL '7 days'` filtrele
2. yfinance'ten ilgili tarih sonrası fiyatlar çek
3. Hesapla: `price_7d`, `price_30d`, `price_90d` ve `actual_return = (price_X - price_at_thesis) / price_at_thesis`
4. Outcome güncelle:
   - Bull başarılı (tez yönü ile getiri uyumlu, >+%5) → `correct`
   - %50+ ters yön → `wrong`
   - Arası → `partial`

### 4.4 Memory Wow-Factor Senaryosu

Demo Senaryo 3 ([`demo.md`](demo.md) §1.3): 6 ay önce yazılmış sahte tez DB'ye seed edilmiş (`outcome=correct`, `actual_return=+18%`). Yeni sorgu → similarity hit → tez içinde "tarihsel bağlam" bölümü judge'a wow.

---

## 5. Conservative Mode Akışı

**Persona Ali Bey ([`product.md`](product.md) §4.3) default conservative.**

```
Orchestrator user profilini oku
        │
        ▼
  user.user_mode = "conservative"?
        │
    ┌───┴───┐
    │       │
   Hayır  Evet
    │       │
    │       ▼
    │   Synthesizer prompt'a flag inject:
    │   - "Bear case'i bull'dan önce yaz"
    │   - "Confidence ≤ 70 ile cap'le"
    │   - "Temettü güvenliği başlığı ekle"
    │   - "Volatilite uyarısı ekle"
    │   - "Sona 'muhafazakar profile uygun mu?' özet ekle"
    │       │
    ▼       ▼
   Normal Synthesizer çalışır
        │
        ▼
   Citation validate (aynı süreç)
        │
        ▼
   UI: Bear başta render edilir (default'ta Bull başta)
```

Davranış kuralları: [`agents.md`](agents.md) §5.

---

## 6. Demo Kill-Switch Akışı

**Amaç:** Sunum sırasında pipeline çökerse 5-10 popüler hisse için pre-baked tez otomatik gösterilir.

**Tetikleyiciler:**

- Toplam pipeline timeout > 90 saniye
- Ardışık 3 tool call fail
- Gemini rate limit (429)
- Manuel kill-switch toggle (`?force_demo=1` query param — sunum operatörü)

```
Orchestrator pipeline başlat
        │
        ▼
┌─────────────────────────┐
│ Watchdog (90s timer)    │
│ + ToolFailCounter (3)   │
└──────────┬──────────────┘
           │
       ┌───┴───┐
       │       │
   ✅ OK     ❌ Trigger
       │       │
       │       ▼
       │   Fixture lookup:
       │   fixtures/thesis/<ticker>/<latest>.json
       │       │
       │       ▼
       │   "⚠️ Demo modu — önceden üretilmiş tez"
       │   uyarısı UI'da (dürüstlük rozeti)
       │       │
       │       ▼
       │   Pre-baked Markdown stream (yapay 8s delay
       │   ile gerçek görünür, token-by-token)
       │
       ▼
       Normal flow continues
```

**Fixture yapısı:** `fixtures/thesis/<ticker>/<YYYY-MM-DD>.json` — `{thesis_md, citations, generated_at, model_versions}`. Demo'dan 24 saat önce `scripts/refresh_fixtures.py` ile yenilenir.

Pre-warm hisseleri: [`demo.md`](demo.md) §2.

---

## 7. Senaryo Karşılaştırması

| Senaryo | Mode | Süre | UI Davranışı | Confidence Cap |
|---|---|---|---|---|
| Mehmet ASELS (default, canlı) | default | ~52s | Bull başta | yok |
| Mehmet ASELS (pre-warm) | default | <8s | Aynı | yok |
| Ali Bey TUPRS | conservative | ~48s | Bear başta, temettü vurgulu | ≤70 |
| Memory similarity (Zeynep) | default | ~52s | "Tarihsel bağlam" bölümü ekstra dolu | yok |
| Kill-switch trigger (sunum) | demo | 8s (yapay) | "⚠️ Demo modu" rozet | önceden hesaplı |
| Veri eksik (chain fail) | default | ~30-60s | "Veri sınırlı" notu, confidence cap | ≤50 |

---

## 8. Follow-up Soru Akışı

Mehmet ilk tezi aldıktan sonra "Bear case'i daha detaylı anlat" yazıyor:

1. Orchestrator → "follow-up" intent algılar
2. Önceki tezin `thesis_id` lookup
3. Cached output (worker raporları + critique + macro) Redis'ten okunur
4. Synthesizer Pro **sadece Bear case'i** yeniden detaylandırır (yeni tool call yok)
5. WebSocket stream — 2-5 saniyede UI'da görünür

**Önemli:** Follow-up'lar tool call yapmaz → yeni `tool_call_logs` satırı yok, ama yeni `theses` satırı oluşur (`parent_thesis_id` v2 feature).
