# Dexter Projesi — Detaylı Analiz ve ThesisForge'a Uyarlama Raporu

> Kaynak: https://github.com/virattt/dexter
> Analiz tarihi: 2026-05-12
> Hedef: Dexter'ın mimari ve teknoloji seçimlerinden ThesisForge için hangilerinin uyarlanabileceğini, hangilerinin ıskartaya çıkarılması gerektiğini eleştirel olarak ortaya koymak.

---

## 0. TL;DR (Yöneticiye Özet)

- **Dexter, tek-ajanlı (single-agent) "deep research" tipi bir finansal araştırma CLI'ı**: LangChain üzerinde çalışan bir tool-calling loop'u, prompt cache'li sistem prompt'u, "scratchpad" denen iç bellek, SQLite tabanlı semantik memory ve "SKILL.md" denen markdown-tabanlı workflow uzantıları içeriyor.
- **ThesisForge ise multi-agent komite mimarisi** (Technical / Fundamental / Sentiment / Devil's Advocate / Synthesizer). Yani **ürün vizyonları farklı**: Dexter'da "tek başına derin düşünen tek bir uzman", ThesisForge'da "birbirini denetleyen bir komite".
- Dexter'dan **mimari olarak uyarlanması gereken** ana fikirler: (1) **Scratchpad + Tool-Result Budget** kalıbı, (2) **SKILL.md** uzantı sistemi (DCF, x-research vb. için ideal), (3) **Context auto-compaction**, (4) **Provider-agnostic LLM katmanı + prompt caching**, (5) **JSONL scratchpad ile debug/eval**, (6) **LangSmith ile eval-as-judge**.
- Dexter'dan **uyarlanmaması gereken** kısımlar: (1) Tek-ajanlı loop felsefesi (ThesisForge için ürün diferansiyatörünü öldürür), (2) WhatsApp gateway scope-creep'i, (3) Ink/CLI tabanlı UI (ThesisForge web-first).
- En büyük "alıntılanabilir" parça: **SKILL.md sistemi**. Tüm "valuation framework, sektör WACC tabloları, KAP filing parsing rule'ları" gibi şeyleri Python kodu yerine **markdown + frontmatter** ile yazıp ajanlara açabiliriz. Bu, hackathon'da "extensibility" demo'su için altın değerinde.

---

## 1. Dexter Tek Cümlede Ne Yapar?

> *"Bir finansal soruyu alıp planlayan, tools (financial data API, web search, browser, SEC filings reader, DCF skill'i) ile araştıran, kendi çalışmasını gözden geçiren ve nihai cevabı sentezleyen tek bir otonom ajan."*

CLI tabanlıdır (Bun + Ink/React). "Dexter" karakter olarak Buffett/Munger felsefesiyle konuşur (bkz. SOUL.md). WhatsApp gateway'i ile self-chat üzerinden de çalışır.

**Kritik benzerlik:** ThesisForge gibi *karar destek sistemi* konumlanmasında — tahmin/öneri vermez, "tez/araştırma" üretir.
**Kritik farklılık:** Dexter **tek ajan**dır, ThesisForge **komite**dir. Bu farkı raporun her bölümünde aklınızda tutun.

---

## 2. Teknoloji Yığını (Stack) — Net Liste

`package.json` ve kaynak kod incelemesinden:

| Katman | Dexter Seçimi | Notlar |
|---|---|---|
| Runtime | **Bun** | Node yerine. Hızlı başlangıç, native TypeScript, native test runner. |
| Dil | **TypeScript (ESM, strict)** | `any` yasak. |
| UI | **Ink (React for CLI)** | `src/index.tsx`, `src/cli.tsx`. Web değil, **terminal**. |
| LLM Framework | **LangChain (@langchain/core)** | Tool-calling ve message abstraction. |
| LLM Sağlayıcıları | **OpenAI (default `gpt-5.5`), Anthropic, Google Gemini, xAI, OpenRouter, Ollama (local)** | `src/model/llm.ts` provider-agnostic facade. Prefix-based detection (`claude-*`, `gemini-*`). |
| Prompt Caching | **Anthropic explicit `cache_control`** | System prompt cache'leniyor. |
| Embeddings | **OpenAI `text-embedding-3-small` / Gemini / Ollama** | `src/memory/embeddings.ts`. Provider failover. |
| Vector Store | **better-sqlite3 + SQLite FTS5 (BM25) + custom vector cosine** | Pinecone/Chroma değil! SQLite + manuel cosine + FTS5 keyword + MMR re-rank. |
| Web Search | **Exa (primary) + Tavily (fallback)** | LangChain entegre. |
| Web Scraping | **Playwright (chromium)** | `postinstall: playwright install chromium`. |
| HTML Parsing | **Mozilla Readability + linkedom** | Filings/article extraction. |
| Finance Data | **financialdatasets.ai API** | Tek vendor'a bağımlı. |
| Validation | **Zod 4.x** | Tool schemas. |
| WhatsApp | **@whiskeysockets/baileys** | Self-chat gateway. |
| Cron | **croner** | `src/cron/` scheduled queries. |
| Tracing | **LangSmith** | Eval + observability. |
| Test | **Bun test (primary) + Jest (legacy)** | Colocated `*.test.ts`. |
| Markdown | **gray-matter** | SKILL.md frontmatter parser. |
| Diff | **diff** | Muhtemelen tool result delta gösterimi. |

**Çıkarımlar ThesisForge için:**

- **LangChain.js** seçimi ilginç. ThesisForge tasarımı Strands (Python) düşünüyorsa, **TypeScript stack'a kaymak için iyi bir kanıt**. Avantaj: aynı dilde monorepo (web + agent), Anthropic SDK + LangChain.js olgun. Dezavantaj: Strands'ın multi-agent primitive'leri Python tarafında daha zengin.
- **SQLite + manuel cosine** seçimi pragmatik ve hackathon dostu: vendor lock-in yok, deploy basit, embed'ler local. ThesisForge için "Postgres + pgvector" yerine başlangıçta **SQLite + sqlite-vss/sqlite-vec** yeterli olabilir.
- **Exa**'yı görmemiş olabilirsiniz — Google/Bing yerine semantik web search API'si. ThesisForge'un haber/KAP araştırması için **Exa + Tavily fallback** zaten LangChain entegre, ücretsiz quota'sı var.
- **financialdatasets.ai** tek vendor riski. ThesisForge'da BIST için **Mynet Finans + KAP RSS + Foreks/Matriks** gibi çoklu kaynak gerekir; benzer "primary + fallback" mantığını koruyun.

---

## 3. Mimari Katmanlar — Detaylı

Dexter `src/` ağacı (gerçek):

```
src/
├── agent/          ← agent loop, prompts, scratchpad, compaction
│   ├── agent.ts        (ana sınıf, max 10 iter, growing message array)
│   ├── compact.ts      (threshold-based full compaction)
│   ├── microcompact.ts (her turn sonrası ufak temizlik)
│   ├── scratchpad.ts   (JSONL log + in-context source of truth)
│   ├── tool-executor.ts (concurrency map, approval, abort signal)
│   ├── prompts.ts      (system prompt builder, SOUL.md + RULES.md inject)
│   ├── token-counter.ts
│   ├── channels.ts     (cli/whatsapp/etc. channel profile)
│   ├── run-context.ts
│   └── types.ts
├── model/llm.ts    ← provider facade (OpenAI/Anthropic/Google/xAI/OR/Ollama)
├── tools/
│   ├── registry.ts (env-conditional tool list)
│   ├── finance/    (15+ alt tool: filings, fundamentals, prices, news,
│   │                insider_trades, screen_stocks, segments, key-ratios…)
│   ├── search/     (Exa + Tavily)
│   ├── browser/    (Playwright)
│   ├── fetch/      (HTTP)
│   ├── filesystem/
│   ├── memory/     (memory tool — LLM kendisi memory yazabilir)
│   ├── cron/       (LLM kendisi scheduled query kurabilir)
│   ├── heartbeat/
│   └── skill.ts    (skill invoker)
├── skills/
│   ├── loader.ts   (gray-matter ile SKILL.md parse)
│   ├── registry.ts (startup'ta tarama)
│   ├── dcf/        (SKILL.md + sector-wacc.md)
│   └── x-research/
├── memory/
│   ├── database.ts (SQLite schema, chunks + FTS5 + embedding cache)
│   ├── embeddings.ts (multi-provider)
│   ├── chunker.ts
│   ├── indexer.ts
│   ├── search.ts   (hybrid: vector + BM25 + MMR + temporal decay)
│   ├── mmr.ts
│   ├── temporal-decay.ts
│   ├── store.ts
│   ├── flush.ts    (session sonu memory write)
│   └── session-files.ts
├── gateway/        ← WhatsApp + multi-channel
│   ├── gateway.ts
│   ├── channels/whatsapp/
│   ├── routing/
│   ├── sessions/
│   ├── group/
│   ├── access-control.ts (+ test)
│   └── agent-runner.ts
├── cron/           ← scheduled agent runs
├── evals/          ← LangSmith + Ink UI eval runner
├── components/     ← Ink UI
├── controllers/
├── commands/
└── index.tsx
```

### 3.1 Agent Loop (en kritik kısım)

`src/agent/agent.ts` özetle:

```typescript
class Agent {
  // 1. Growing message array (full reasoning continuity)
  // 2. Concurrent execution for read-only tools (concurrencyMap)
  // 3. Streaming LLM responses with fallback to blocking
  // 4. Per-turn microcompact + threshold-based full compaction
  // 5. Default max 10 iterations
  // 6. Abort signal support
  // 7. Tool approval hook (interactive)
}
```

Olay (event) tipleri stream ediliyor: `tool_start`, `tool_end`, `thinking`, `answer_start`, `done`, `compaction`, `context_cleared`, `microcompact`, `queue_drain`, `stream_progress`. **Bu event modeli ThesisForge web UI için doğrudan kullanılabilir** — her ajan kolonu kendi event stream'ini dinler.

### 3.2 Scratchpad (parlak fikir)

`src/agent/scratchpad.ts` — **her query bir JSONL dosyası** yazıyor:
```
.dexter/scratchpad/2026-01-30-111400_<hash>.jsonl
```
İçinde her satır:
```json
{"type":"tool_result","timestamp":"…","toolName":"get_income_statements","args":{…},"result":{…},"llmSummary":"5 yıllık gelir tablosu…"}
```

**Neden parlak:**
- Debug için: "agent ne gördü, ne dedi" tam izlenebilir.
- Eval için: dataset ground truth replay edilebilir.
- Halüsinasyon savunması: final cevaptaki her sayı için "hangi tool çağrısına dayanıyor" diye eşleştirilebilir.

**ThesisForge için kritik:** Bizim "citation-grounded" tasarımımız bunu zaten gerektiriyor. Dexter'ın JSONL formatı doğrudan kopyalanabilir.

### 3.3 Context Compaction

İki kademe:
- **Microcompact** (her turn'de): Eski tool result'larını LLM özetine indirir.
- **Full compaction** (token threshold aşılınca): Daha agresif, geçmiş round'ları kısaltır.
- **MIN_TOOL_RESULTS_FOR_COMPACTION** ve **MAX_CONSECUTIVE_COMPACTION_FAILURES** gibi guard'lar var.

Ek koruma: **Tool result budget** (`src/utils/tool-result-budget.ts`) ve **large result persistence** — büyük tool çıktıları diske yazılıp context'e referans bırakılıyor.

**Uyarlama:** Komite mimarisinde her worker ajanın **kendi mini context window**'u olduğu için Dexter'a kıyasla daha az gerekli, **ama Synthesizer için kritik** (3 worker + devil's advocate çıktısı + memory hits → kolayca 50K token).

### 3.4 SKILL.md Sistemi (en uyarlanabilir parça)

```markdown
---
name: dcf-valuation
description: Performs discounted cash flow (DCF) valuation analysis to estimate intrinsic value per share. Triggers when user asks for fair value, intrinsic value, DCF, valuation, "what is X worth"…
---

# DCF Valuation Skill

## Workflow Checklist
- [ ] Step 1: Gather financial data
- [ ] Step 2: Calculate FCF growth rate
…

## Step 1: Gather Financial Data
Call the `get_financials` tool with these queries:
### 1.1 Cash Flow History
**Query:** `"[TICKER] annual cash flow statements for the last 5 years"`
…
```

Mekanik:
1. Startup'ta `src/skills/registry.ts` tüm SKILL.md'leri tarar.
2. Sistem prompt'una **sadece metadata** (name + description) inject edilir.
3. LLM `skill` tool'unu çağırınca **full instructions** prompt'a yüklenir.
4. Skill başına **per-query çağrı limiti = 1** (rekürsif loop savunması).

**ThesisForge'a katkısı:**
- Hackathon'da "extensibility" demo'su = "yeni bir analiz tarzı eklemek için sadece bir markdown dosyası yazıyorum" → judge'a etkileyici.
- "Sector squad" mantığını skill'lere çevirebiliriz: `skills/banking/SKILL.md`, `skills/energy/SKILL.md`, `skills/defense/SKILL.md`. Worker ajanlar sektöre göre uygun skill'i çağırır.
- DCF skill'ini neredeyse **olduğu gibi adapte edebiliriz** (sector-wacc.md dahil).

### 3.5 Memory (Hybrid Retrieval — incelenmeye değer)

`src/memory/` — RAG için fancy bir setup:
- **SQLite chunks tablosu** + embedding BLOB.
- **chunks_fts** virtual table (FTS5/BM25 keyword search).
- **Hybrid search:** vector cosine + BM25 → MMR re-rank → temporal decay weighting.
- **Embedding cache** (aynı metni iki kere embed etmeyiz).
- **session-files.ts:** session boyunca biriken not'ları flush eder.

**Uyarlama:** ThesisForge "geçmiş tez + benzer tez + base rate" için pgvector planlıyordu; **SQLite + sqlite-vec ile MVP** çok daha hızlı kurulur. Vendor maliyeti yok. Production'da Postgres'e migrate edilir.

### 3.6 LLM Provider Abstraction

`src/model/llm.ts` tek bir `callLlmWithMessages` ve `streamLlmWithMessages` arkasında 6 sağlayıcı. **FAST_MODELS** map'i ile "ucuz/hızlı" varyant seçilebiliyor (özet, classification gibi hafif işler).

**ThesisForge eşleştirmesi:**
- Worker ajanlar = **Haiku/Gemini Flash** (paralel + hızlı + ucuz).
- Devil's Advocate = **Sonnet** (kritik düşünme).
- Synthesizer + Citation Validator = **Opus** (en kaliteli, tek sefer).
- Orchestrator/Router = **Haiku** (basit intent extraction).

Dexter'ın `FAST_MODELS` haritasını birebir bu kalıba çevirebilirsiniz.

---

## 4. ThesisForge ↔ Dexter Karşılaştırması (eleştirel)

| Boyut | Dexter | ThesisForge | Karar |
|---|---|---|---|
| **Topoloji** | Single agent, iterative tool-use | Multi-agent komite (paralel worker + devil's advocate + synthesizer) | ThesisForge'un farkı **bu**. Dexter'a benzemeyin. |
| **Konum** | Karar destek (Buffett/Munger karakteri) | Karar destek + Türkiye retail | Aynı pazarlama dili (regülasyon savunması). |
| **UI** | Ink CLI | Web (Next.js/SvelteKit?) | Hackathon judge'ı web bekler. CLI yok. |
| **Streaming** | Typed event stream (tool_start, thinking, answer_start, …) | Komite "kolonları" real-time stream | **Dexter event modelini birebir alın**, kolon başına filtre. |
| **Memory** | SQLite + FTS5 + cosine + MMR + temporal decay | Geçmiş tez + base rate + benzer tez | **Dexter memory'sini birebir alın** (hackathon için ideal). |
| **Skill** | SKILL.md + frontmatter | Sektör squad'ları, valuation methods | **SKILL.md sistemini birebir alın**, sektörel skill'ler yazın. |
| **Provider** | 6 LLM provider + Ollama | Multi-model (worker ≠ synthesizer) | **Aynı facade'i alın**. |
| **Data** | financialdatasets.ai (ABD) | KAP + Mynet + Foreks + (Matriks?) | Sadece tool listesi farklı, mimari aynı. |
| **Eval** | LangSmith + LLM-as-judge | Hackathon için "demo dataset" yeterli | **LangSmith setup'ı kopyala**, judge'a "evals var" deyince güçlü. |
| **Scheduled** | Cron tool (LLM kendisi kurar) | Watchlist haftalık güncelleme | İlginç fikir ama scope dışı, ihmal edin. |
| **WhatsApp** | Baileys gateway | — | **Scope creep. Yapma.** |
| **Citation Validator** | İmplicit (scratchpad'den çıkarım) | Explicit agent | ThesisForge'da **explicit tut**. Bu sizin farkınız. |
| **Devil's Advocate** | Yok | Var | Sizin farkınız. Tutun. |
| **Sector Router** | Yok | Var | Sizin farkınız. Tutun. |

---

## 5. ThesisForge'a Doğrudan Uyarlama Önerileri (Aksiyon Listesi)

### 5.1 Hemen Kopyalanması Gerekenler

1. **Scratchpad JSONL formatı** (`.thesisforge/scratchpad/<date>_<hash>.jsonl`)
   - Her tool çağrısı için: `args`, `result`, `llmSummary`.
   - Citation validator final cevaptaki her sayıyı bu dosyaya bağlar.

2. **SKILL.md sistemi**
   - `gray-matter` + frontmatter (`name`, `description`, ekstra: `sector`, `trigger`).
   - Built-in skill'ler:
     - `skills/dcf/SKILL.md` (Dexter'dan adapte, BIST için TL/USD ayrımı + ülke risk premium)
     - `skills/banking/SKILL.md` (NPL, NIM, sermaye yeterlilik özel kuralları)
     - `skills/energy/SKILL.md` (EPDK, ham petrol pass-through)
     - `skills/defense/SKILL.md` (ASELS, OTKAR vb. — TSKGV bağlam)
     - `skills/macro-tr/SKILL.md` (CBT faiz, döviz kuru, BIST endeks bağlamı)
   - **Demo'da etki:** "Yeni sektör eklemek için bir markdown dosyası yazıyorum" → 20 saniyelik demo.

3. **Provider abstraction (`model/llm.ts` paterni)**
   - `callLlm(model, messages, opts)` + `streamLlm(...)`.
   - `FAST_MODELS` haritası: Haiku worker, Sonnet devil's advocate, Opus synthesizer.

4. **Hybrid memory (SQLite + FTS5 + cosine + MMR)**
   - Hackathon süresince Postgres+pgvector kurma. **better-sqlite3 + sqlite-vec** yeterli.
   - Tablolar: `theses`, `chunks`, `chunks_fts`, `embedding_cache`.
   - "Bu hisseye 3 ay önce ne demiştik" gibi sorgu doğrudan demo malzemesi.

5. **Anthropic prompt caching (`cache_control`)**
   - System prompt + persona + SKILL metadata bloğunu cache'le.
   - Worker'lar paralel koşunca aynı sektör persona'sı 3 kez cache hit eder → ciddi tasarruf.

6. **Typed event stream**
   - `worker_start`, `worker_thinking`, `worker_tool_call`, `worker_done`, `devil_start`, `devil_question`, `synth_start`, `synth_stream`, `citation_check`, `done`.
   - Web UI'da her kolon kendi `worker_id` filtresi ile dinler.

### 5.2 Kavramsal Olarak Alın, Aynen Değil

7. **Context auto-compaction** — Worker'lar için gereksiz (kısa hayat). **Synthesizer ve Devil's Advocate için microcompact yeter**, full compact gerekmez (token bütçesi sınırlı tutulursa).

8. **Memory tool (LLM kendi memory yazar)** — ThesisForge'da Synthesizer **otomatik** memory yazsın; LLM kendi karar vermesin. Daha kontrollü.

9. **Eval suite (LangSmith)** — Hackathon için 10 BIST hisseli "golden set" yeterli. Judge'a "evals dataset'imiz var, %X accuracy" demek güçlü.

### 5.3 Kesinlikle Yapmayın

10. **WhatsApp gateway** — scope creep. Hackathon süresinde yapılmaz, demo'da bir şey katmaz.

11. **CLI/Ink UI** — judge web bekler. Web tek frontend.

12. **Cron-as-tool (LLM kendisi cron kurar)** — Güvenlik ve maliyet riski. Watchlist için **uygulama düzeyinde** cron yazın (Vercel Cron / Cloudflare Cron Trigger).

13. **Tek-vendor finance API** — financialdatasets.ai'nin Türkçe muadili yok. Çoklu kaynak gerekir: KAP RSS, Mynet, Investing.com scrape, opsiyonel Matriks.

14. **"Growing message array, full continuity"** felsefesi (Dexter agent.ts) — multi-agent'ta her worker **fresh context** ile başlamalı (Buffett'ın "yeniden okuma" fikrini Dexter'ın **kendisi de SOUL.md'de savunuyor**, ama mimarisi tersini yapıyor — siz mimaride de uygulayın).

---

## 6. Önerilen ThesisForge Stack'ı (Dexter'dan damıtılmış)

```
Runtime:     Bun                     (Dexter'dan al, hızlı + native TS)
Dil:         TypeScript strict ESM   (Dexter'dan al)
Web:         Next.js 15 App Router   (Dexter ≠ web; ThesisForge için ekle)
LLM:         Anthropic SDK direkt + LangChain.js (tool-calling için)
             ─ Worker: claude-haiku-4-5
             ─ Devil:  claude-sonnet-4-6
             ─ Synth:  claude-opus-4-7
Cache:       Anthropic cache_control on system + persona + skills metadata
Streaming:   SSE (Next.js Route Handler) — Dexter event model
Tool exec:   Kendi loop'unuz; Dexter agent.ts kalıbı (max iter, abort signal,
             concurrency map, microcompact)
Skills:      SKILL.md + gray-matter (Dexter'dan birebir)
Memory:      better-sqlite3 + sqlite-vec + FTS5 (Dexter pattern)
             ─ chunks, chunks_fts, embedding_cache
             ─ hybrid search + MMR + temporal decay
Embedding:   OpenAI text-embedding-3-small (Dexter default)
             veya Gemini embedding-001 (Dexter alt)
Search:      Exa + Tavily fallback (Dexter'dan birebir)
Scrape:      Playwright (Dexter'dan birebir; KAP filings için)
HTML:        @mozilla/readability + linkedom (Dexter'dan birebir)
Validation:  Zod 4 (Dexter'dan birebir)
Cron:        Vercel Cron / Cloudflare Cron (uygulama düzeyi, LLM tool DEĞİL)
Tracing:     LangSmith (Dexter'dan al)
Test:        Bun test (Dexter'dan al)
Markdown:    gray-matter (SKILL.md için; Dexter'dan birebir)

Data (TR):   KAP RSS + scrape, Mynet Finans, Investing.com, Foreks/Matriks
             (Dexter'ın finance/ tool kalıbı, ama Türkiye adaptasyonu)
```

---

## 7. Hackathon-Kritik 3 Çıkarım

1. **SKILL.md = en iyi "wow" malzemesi.** Judge'a "yeni sektör eklemek 30 saniye sürer" demo'su yapın. Dexter'ın `src/skills/dcf/SKILL.md` dosyasını **birebir referans alın**.

2. **Scratchpad JSONL = citation-grounded mimarinizin omurgası.** "Her cümlenin kaynağı var" iddiasını kanıtlamak için Dexter formatını birebir alıp UI'da **her cümleye hover tooltip → JSONL satırı** gösterin.

3. **Multi-agent farkınızı koruyun.** Dexter "tek dahi", ThesisForge "komite". Dexter'ın SOUL.md'sini taklit etmek yerine her ajana **kendi rolüne uygun mini-SOUL** verin: `agents/technical/PERSONA.md`, `agents/devil/PERSONA.md` gibi. Bu hem Dexter pattern'i (SOUL.md inject) hem ürün farkınız (komite).

---

## 8. Riskler / Notlar

- **LangChain.js sürüm hızı:** Dexter `@langchain/core ^1.1.36` kullanıyor; LangChain 1.x ekosistemi yeni. Production'da breaking change riski; hackathon için sorun değil.
- **financialdatasets.ai'nın TR muadili yok** — bu kısmı sıfırdan kuracaksınız, Dexter'dan kopyalanamaz. En büyük emek kalemi.
- **Bun + Playwright** etkileşimi bazen Linux container'da sorun çıkarır; deploy'da Vercel kullanacaksanız Playwright'ı Vercel Functions'tan ayrı bir **scrape worker**'a alın (Fly.io / Railway).
- Dexter'ın tool sayısı (15+ finance tool + 5 destek tool) **tek ajan için bile çok**. Komite'de bunu **squad başına 3-5 tool**'a indirin, aksi halde her worker karar veremez hale gelir.

---

## 9. Tek Cümlede Sonuç

> Dexter'dan **SKILL.md sistemini, scratchpad JSONL'i, hybrid SQLite memory'yi, provider abstraction'ı ve typed event stream'i** çal; **tek-ajan loop felsefesini, WhatsApp gateway'i, CLI UI'yi ve LLM-controlled cron'u** çalma. Geri kalanı ThesisForge'un komite mimarisi ve Türkiye konumlandırması ile farklılaş.
