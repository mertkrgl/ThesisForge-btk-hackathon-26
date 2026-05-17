# Backend Analiz Raporu — ThesisForge

**Tarih**: 2026-05-16
**Kapsam**: `backend/app/` (agents, prompts, runtime, DB, API, citations, data providers)
**Hedef**: BTK 2026 hackathon teslimine kadar (6 gün) yapılması gereken optimizasyon ve düzeltme listesi

---

## Yönetici Özeti

Sistem **omurga olarak sağlam**: 7 agent + Devil's Advocate, Strands+Gemini DAG'ı, 3-katmanlı citation validator, pgvector memory, async DB. Üretilen tezler kaynaklı, denetlenebilir, schema-uyumlu.

Ama **demo kalitesini ve jüri etkisini düşüren 12+ somut sorun** var. Bunların 5'i kritik (yanlış sinyal üreten matematik veya dead code), 4'ü performans/UX, 3'ü stratejik eksiklik.

**Önerilen sıralama (6 gün için)**:
1. **Gün 1-2**: P0 hatalar — confidence formülündeki "data_quality hep 100" ve "technical clip 0-100 ama formül -50'ye iniyor" bug'ları, retry telemetrisi.
2. **Gün 3**: Synthesizer extract'ı deterministik parser'a çevir (5-15s tasarruf + retry oranı düşer).
3. **Gün 4**: News sentiment provider + base rate seed data (Devil's Advocate'in zayıf çıkmasını engeller).
4. **Gün 5**: Tool-level paralelizasyon (worker süresi 35s → 12s — büyük demo wow factor).
5. **Gün 6**: Demo dry-run + fixture fallback testi + final UI integration.

---

## 1. KRİTİK BUG'LAR (P0 — demo kalitesini bozar)

### 1.1 `data_quality` her zaman 100 çıkıyor → sinyal değersiz

**Dosya**: `backend/app/db/repo.py:103-120` (`count_tool_calls_for_thesis`) + `orchestrator.py:246-247`

**Sorun**: `total` ve `success` aynı değerden hesaplanıyor (`result IS NOT NULL`). Ama tool exception olursa `tools.py:73-86` zaten INSERT'i atmıyor (raise ediyor). Yani **başarısız tool DB'ye hiç yazılmıyor** → `total == success` her zaman.

Sonuç: Her run'da `data_quality = 100`, confidence ağırlığı 0.25 → final skora **+25 puan sabit katkı**. Bu skoru "veri kalitesi yüksek tez" değil "hiçbir bilgi vermeyen sayı" yapıyor.

**Düzeltme** (~30 dk):
- Her ajan için **beklenen tool sayısı** tanımla (technical: 5, fundamental: 6, macro: 4, devil: 3 → toplam 18).
- `data_quality = (gerçek_success / beklenen_total) * 100`.
- Alternatif minimal fix: exception path'inde de tool_call_logs satırı INSERT et (`result=null`), böylece `total` gerçek tüm denenen çağrıları sayar.

### 1.2 `momentum_score` formülü 0-100 aralığını taşıyor

**Dosya**: `backend/app/agents/prompts/technical_worker.md:21`

**Formül**: `50 + (RSI-50) + MACD_sign*15 + RS_sign*20`, clip(0, 100).

**Sorun**: MEPET için RSI=36 → -14, MACD negatif → -15, RS negatif → -20 → `50-14-15-20 = 1`. Bu **patolojik bearish skor**. Confidence'a 0.20 ağırlıkla giriyor → `1*0.20 = 0.2 puan`. Tezin matematiği "bu hisse %0 momentum" diyor.

Gerçek RSI bandı 30-70 aralığındaysa skor 16-86 olmalı; ama RSI 36 + MACD negatif + RS negatif gibi **birikimli negatif sinyaller** patolojik biçimde dipliyor.

**Düzeltme** (~1 saat):
- Her bileşeni sınırlandır: `RSI delta = clip(RSI-50, -25, +25)`, `MACD = ±10`, `RS = ±15` → toplam aralık [-50, +50] → clip [0, 100] sonrası [0, 100].
- Veya prompt'taki formülü silip Python-side hesaplayan deterministic bir post-processor yaz (LLM bu aritmetiği güvenilir yapmıyor zaten).
- **Önerilen**: Skoru `technical_worker.py` içinde **kod**la hesapla; LLM `notable_observations` üretsin, skor Python'da çıksın. LLM aritmetik yapmasın.

### 1.3 `news_macro` skoru binary (40 veya 60)

**Dosya**: `backend/app/agents/orchestrator.py:104-111`

**Sorun**: `_news_macro_score` sadece "paragraph üretildi mi?" diye bakıyor. Confidence ağırlığı 0.15 → **her tez ya +9 ya +6 alıyor**. Macro içeriği bullish mi bearish mi, news sentiment pozitif mi negatif mi — hiç ölçülmüyor.

**Düzeltme** (~2 saat):
- `MacroContextOutput`'a `sentiment_score: float` field'ı ekle (-100..+100).
- `macro_context.md` prompt'una "paragrafın sonuna `sentiment_score` üret" ekle.
- Veya `find_disconfirming_evidence` haber sayısı + Devil's Advocate'in `cross_cutting_risks` uzunluğunu birleştir.
- En azından: `news_macro_score = 50 + macro.sentiment * 50` olacak şekilde dinamik.

### 1.4 Sector Router agent'ı dead code

**Dosya**: `backend/app/agents/sector_router.py:34-49` + `prompts/sector_router.md`

**Sorun**: `run_sector_router` önce `sector_map.yaml`'a bakar (rule-based primary, ~0ms). Bulamazsa **LLM fallback** devreye giriyor — ama o LLM yine `select_squad` tool'unu çağırıyor, o da yine YAML'a bakıp `squad_for_ticker(upper)` döndürüyor (= "Generic" fallback). Yani LLM çağrısı sıfır bilgi katmıyor, 3-5s harcıyor.

**Düzeltme** (~15 dk):
- LLM fallback'i kaldır. YAML'da yoksa direkt `SectorAssignment(squad="Generic", confidence=60)` döndür.
- VEYA gerçek LLM reasoning ekle: "Şu ticker hangi sektör, hangi peer'larla benzer? Web aramayı kullan." Bu zaman bütçesinde olmaz, ilk seçenek.

### 1.5 Memory Agent prompt dead code

**Dosya**: `backend/app/agents/prompts/memory_agent.md`

**Sorun**: `memory_agent.py:search_memory` direkt embedding + DB query yapıyor; **Agent oluşturmuyor**, prompt yüklemiyor. Yani `memory_agent.md` hiç okunmuyor.

**Düzeltme** (~5 dk): Prompt dosyasını sil (veya başına `# DEPRECATED — kullanılmıyor, search_memory deterministic` ekle). Demo sırasında jüri kod gezerse dead artifact görmesin.

---

## 2. PERFORMANS SORUNLARI (P1 — demo süresini kısaltır)

### 2.1 Strands tool'ları SEQUENTIAL çalışıyor (en büyük performans pay'i)

**Dosya**: `backend/app/agents/runtime.py:115` — `tool_executor=SequentialToolExecutor()`

**Sorun**: Her worker (technical 5 tool, fundamental 6 tool) tool'larını **sırayla** çağırıyor. Her tool ~5-7s sürerse:
- Technical worker: 5×7 = 35s
- Fundamental worker: 6×7 = 42s

Eğer paralel çalışsa worker süresi `max(tool_süreleri) + LLM_reasoning ≈ 10-15s` olur.

**Sebep** (yorumda yazılı): "Aynı SQLAlchemy AsyncSession'ı paylaşan paralel tool'lar concurrent execute → çakışma."

**Düzeltme** (~3-4 saat):
- `ParallelToolExecutor` kullan + her tool kendi `session_scope()`'unu açsın (`tools.py:tool` decorator içinde).
- Veya tool decorator'a "her çağrıda fresh session" davranışı ekle (`session=None` → otomatik `async with session_scope() as session`).
- Tek pipeline'da ~40s tasarruf, total 170s → 130s'in altına iner.

### 2.2 `extract_structured` ikinci LLM çağrısı gereksiz (5-15s)

**Dosya**: `backend/app/agents/synthesizer.py:202-226`

**Sorun**: Synthesizer markdown bullet'larında `- <metin> [kaynak: <uuid>]` formatı zaten var. Bunu LLM'e "JSON'a çevir" diye 8192 token bütçesiyle Flash model çağrısı **gereksiz**. Aynı zamanda potansiyel hata kaynağı (LLM bullet metni yeniden formüle edebilir).

**Düzeltme** (~1 saat):
- `_extract_bullets_regex(md, section_name)` Python fonksiyonu yaz. UUID regex ile ayrıştır.
- `score` heuristik: kaynaklı + sayı var → 8-9; sadece kaynaklı → 7; sadece sayı → 6; ikisi yok → 4.
- `catalysts` için tarih regex (`YYYY-MM-DD|YYYY-Q[1-4]|YYYY-H[1-2]`).
- Tipik kazanç: 5-15s + cost düşüşü + deterministic davranış.

### 2.3 Validator retry oranı görünmüyor

**Dosya**: `backend/app/citations/validator.py:85-125`

**Sorun**: Citation validator missing/invalid UUID veya numeric issue gördüğünde synthesizer'ı 1 kez retry ediyor (~20-30s). MEPET run'ında **validator 53s sürdü** — büyük ihtimal retry tetiklendi. Ama log'da retry oranı agregat olarak görünmüyor.

**Düzeltme** (~30 dk):
- `log.warning("citation_retry", ...)` zaten var (`validator.py:117`). Demo öncesi 10 ticker run'la, retry oranını ölç.
- Eğer >%30 ise synthesizer prompt'una "**UYDURMA UUID YASAK**, sadece observation listelerinden al" ekstra vurgu ekle.
- Hedef: ilk denemede %85+ pass rate.

### 2.4 `_chunked_emit` artificial sleep 3.6s yapay bekleme

**Dosya**: `backend/app/agents/orchestrator.py:69-79`

**Sorun**: 5400 char / 60 chunk × 0.04s = 3.6s tamamen yapay bekleme. UI "yazılıyor" hissi için ama veriyi anında basabilir.

**Düzeltme** (~5 dk):
- `chunk_size=60 → 250`, `sleep=0.04 → 0.015` → toplam 0.32s.
- Veya frontend tarafında token typewriter animation yapılırsa backend tek `final_md` event'i basıp sleep'i tamamen kaldırabilir.

### 2.5 `run_thesis` default timeout 120s, chat 300s — tutarsız

**Dosya**: `orchestrator.py:124` (default 120) vs `chat.py:95` (override 300)

**Sorun**: 300s = 5 dakika kullanıcı için kabul edilemez. 120s ise mevcut akışta yetmiyor (170s sürüyor).

**Düzeltme** (~10 dk):
- Pipeline 130s'e ininceye kadar geçici 200s.
- Sonra 150s'e sıkılaştır. Anomali olursa erken error event basılsın.

---

## 3. PROMPT KALİTESİ (P1 — demo çıktısı kalitesi)

### 3.1 Devil's Advocate güçlü ama `base_rate_check` boş dönüyor

**Dosya**: `backend/app/agents/prompts/devils_advocate.md:32-37` + `tool_registry.py:296-322`

**Sorun**: Prompt "her base rate warning sayısal olmak zorunda" diyor. Ama `base_rate_check` DB'den `Thesis.outcome != 'pending'` query'liyor — **DB boş** (yeni proje, hiç tez backtest edilmemiş). Sonuç: `base_rate_warnings=[]` veya tek satır "veri yok".

MEPET çıktısında bunu gördük:
```
Base Rate Warnings
- "Generic" squad için geçmiş tez başarı oranı verisi bulunmamaktadır
```

Devil's Advocate'in en güçlü silahı (sayısal base rate) **boş çalışıyor**.

**Düzeltme** (~1-2 saat):
- **Seed data**: 30-50 sahte tez fixture'ı oluştur (`fixtures/seed_theses.json`) — her squad için 5-10 örnek, outcome dağılımı gerçekçi (~%50 correct, %30 partial, %20 wrong).
- Alembic migration'da veya `scripts/seed_demo.py` ile DB'ye yükle.
- Demo öncesi `scripts/seed_demo.py` çalıştırılır, jüri gerçek base rate görür.
- **VEYA**: `base_rate_check` fallback olarak **historical fixtures'tan** (BIST tarihsel volatilite, RSI>70 düzeltme oranı gibi public istatistikler) sabit değerler döndürsün.

### 3.2 Synthesizer'da Bear Case kaynak eşleştirme zayıf

**Karşılaştırma**: `thesis_output_MEPET_default.md` — 6 Bear bullet'tan 4'ü kaynaklı, 2'si kaynaksız (33% miss). Prompt'taki hedef "%70+ kaynaklı".

**Sorun**: Synthesizer Devil's Advocate'in `cross_cutting_risks` (jeopolitik, strateji belirsizliği) için Worker UUID eşleştirmeye çalışıyor ama ilgili UUID yok → kaynaksız bırakıyor.

**Düzeltme** (~1 saat):
- `synthesizer.md:76-84` "Bear Case için kaynak eşleştirme" bölümü zaten var ama Devil's Advocate çıktısının kendisi observation içermiyor.
- **Devil's Advocate output schema'sına** `citation_call_ids: list[str]` ekle. Her pushback için Devil's Advocate'in `query_workers` tool'undan dönen UUID'lerden ilgili olanı kendisi etiketlesin.
- Synthesizer prompt'a "Devil's Advocate `cross_cutting_risks` için UUID'leri Devil'in kendi observation pool'undan al" ekle.

### 3.3 Macro Context prompt çok minimal (18 satır)

**Dosya**: `backend/app/agents/prompts/macro_context.md`

**Sorun**: Sadece "tool çağır, paragraf yaz" diyor. `notable_observations` üretim kuralı yok (Pydantic schema'da var ama prompt zorlamıyor). Sonuç: macro observation'ları boş geliyor, Synthesizer macro'dan kaynak çekemiyor.

**Düzeltme** (~30 dk):
- `technical_worker.md`'deki "Observation üretim kuralları" bölümünü Macro'ya da kopyala (4 zorunlu observation: TCMB, BIST, Brent, USD).
- Her observation `citation_call_id` ile.

### 3.4 6 squad prompt'u birbirinin neredeyse kopyası

**Dosyalar**: `fundamental_banking.md`, `_energy.md`, `_defense.md`, `_retail.md`, `_realestate.md`, `_generic.md` (toplam 517 satır)

**Sorun**: %80 ortak içerik (sıralı tool çağrıları, observation kuralları, citation zorunluluğu). Sadece `key_metrics` tablosu (NIM/CAR/NPL vs PE/PB/ROE vs refining_margin) değişiyor.

**Düzeltme** (~1 saat — opsiyonel, hackathon scope'unda zorunlu değil):
- Tek `fundamental_base.md` + 6 küçük `metrics_*.md` (sadece squad metrikleri).
- `fundamental_worker.py` runtime'da string concat.
- Yararı: prompt değişikliği 6 yerde değil 1 yerde yapılır.

### 3.5 Synthesizer prompt'unda örnek çıktı 2026 dışında

**Dosya**: `backend/app/agents/prompts/synthesizer.md:108-145` (ASELS örneği)

**Sorun**: Örnek tarih bağlamı net değil. Bugün 2026-05-16; örnekteki "2026 backlog" "2025-Kasım memory" tarihleri kafa karıştırıcı. LLM bazen örnekteki ASELS sayılarını gerçek hisse cevabına kontamine edebilir.

**Düzeltme** (~10 dk):
- Örneği fake bir ticker'a (`FAKE_DEMO`) çevir, sayıları rakam-rakam yaz ki LLM "bu örnek, kopyalama" anlasın.

---

## 4. MİMARİ / KORREKTLIK SORUNLARI (P2)

### 4.1 `WSHub` single-instance — multi-worker uvicorn'da bozulur

**Dosya**: `backend/app/api/ws_hub.py`

**Sorun**: In-memory `dict[uuid, Queue]`. Pipeline worker-1'de publish, subscriber worker-2'de bağlanırsa event'leri görmez.

**Hackathon impact**: Local demo'da tek uvicorn worker → sorun değil. Production'da Redis pub/sub lazım. Dokümante edilmiş (`ws_hub.py:1-3` "Aşama 13").

**Aksiyon**: Demo öncesi `uvicorn ... --workers 1` zorla. README/run.sh'e not düş.

### 4.2 `_FALLBACK_MD` kullanıcıya gidiyor

**Dosya**: `backend/app/agents/synthesizer.py:152-155, 197-199`

**Sorun**: Synthesizer fail olursa "Sentez ajanı çalışamadı; özet üretilemedi." markdown'ı **WS üzerinden kullanıcıya stream ediliyor**. Demo'da Gemini 503 olursa rezalet.

**Düzeltme** (~30 dk):
- Pro model 503 retry zaten var (3 retry, ~26s). Bu yeterli değilse Flash'a fallback dene.
- Fallback markdown'ı stream **etme**; bunun yerine `{"type": "error", "msg": "Sentez geçici olarak çalışmıyor, lütfen 1 dk sonra tekrar"}` event'i bas.

### 4.3 `extract_structured` ve `chunked_emit` paralelleştirildi — order risk

**Dosya**: `backend/app/agents/orchestrator.py:294-303` (önceki turda yazdığımız değişiklik)

**Sorun**: extract paralelde çalışırken stream akarsa, kullanıcı "done" eventi'ni structured veri persist olmadan görebilir. Persist 10 satır sonra geliyor, OK.

**Aksiyon**: Mevcut akış doğru — `await asyncio.gather(...)` ikisini bekliyor, sonra persist. Sadece dokümante et: WS subscriber'a "done" eventi geldiğinde `/api/thesis/{id}` GET'i strikt tutarlı.

### 4.4 Tool wrapper 2-katmanlı (registry + strands_tools)

**Dosyalar**: `tool_registry.py` (gerçek implementation) + `strands_tools.py` (Strands `@strands_tool` wrapper'ları)

**Sorun**: Her tool 2 yerde tanımlı:
1. `tool_registry.py:50` — `@tool("get_tcmb_indicators")` deterministic wrapper, AgentContext alır
2. `strands_tools.py:35` — `@strands_tool async def get_tcmb_indicators()`, contextvar'dan AgentContext okur

Sebep yorumda: Strands Agent tool'a AgentContext geçirmez, contextvar bridge gerekti.

**Aksiyon (opsiyonel)**: Strands SDK'nın `state` injection özelliği varsa direkt geçilebilir. Refactor maliyeti yüksek, hackathon scope'unda **dokunma**.

### 4.5 `_run_isolated` her ajan kendi session'ı ama orchestrator session da var

**Dosya**: `backend/app/agents/orchestrator.py:82-101` + `155-329`

**Sorun**: Pipeline başına ~12-15 DB connection açılışı (NullPool). Her ajan + orchestrator + validator + final persist.

**Aksiyon**: PgBouncer transaction pooling önünde olsa sorun yok. Demo öncesi `docker-compose.yml`'e pgbouncer eklenmeli (15 dk).

### 4.6 `_FACTUAL_NUMBER_RE` teknik sayıları (RSI, MACD) atlıyor

**Dosya**: `backend/app/citations/validator.py:39-47`

**Sorun**: Sadece para/yüzde/çarpan yakalıyor. "RSI 71" gibi teknik sayılar **finansal değil** sayıldığı için kaynaksız bırakılabiliyor → `had_kaynaksiz_flag` tetiklenmiyor.

**Pozitif**: Bu tasarım kararı (`validator.py:50-52` yorumu). RSI claim'lerinde UUID zaten oluyor çünkü `technical_worker` her observation için `calculate_indicators` UUID'sini koyuyor.

**Aksiyon**: Şu hâli **doğru**, dokunma. Demo öncesi 5-10 ticker run'la doğrula.

### 4.7 Squad metrics validation eksik

**Dosya**: `backend/app/agents/schemas.py:91-113` (`FundamentalAnalysis`)

**Sorun**: `key_metrics_json: str` (Pydantic'in dict desteklememesi nedeniyle). LLM bozuk JSON string dönerse downstream kırılır. Validation yok.

**Düzeltme** (~20 dk):
- `FundamentalAnalysis` üzerinde `@field_validator("key_metrics_json")` ekle → `json.loads` dene, başarısızsa `"{}"` fallback.

---

## 5. EKSİK / EKLENMESİ GEREKEN ÖZELLİKLER (P2-P3)

### 5.1 News sentiment provider — `news_macro` gerçek skoru için

**Mevcut**: `news_company` ve `news_market` provider'ları Google News RSS başlıkları çekiyor; sentiment analizi yok.

**Eklenecek** (~3 saat):
- `app/data/providers/news.py`'a basit sentiment skoru ekle (keyword-based veya Gemini Flash ile başlık başına 1-cümle skorlama).
- `MacroContextOutput.sentiment_score: float` field'ı.
- `_news_macro_score` bunu kullansın.

### 5.2 Backtest pipeline ve confidence kalibrasyonu

**Mevcut**: `WEIGHTS` (`confidence.py:6`) sabit, hiç doğrulanmamış. `update_thesis_outcome` cron var ama backtest run script'i yok.

**Eklenecek** (~4 saat — hackathon nice-to-have):
- `scripts/backtest.py`: Son 30 tez için actual return ile confidence eşleştirmesi.
- Skor-getiri grafiği fixture/notebook.
- Demo'da "şu 20 teste baktık, confidence>70 olanların %X'i correct" diyebilmek **çok güçlü bir jüri pitch**i.

### 5.3 Multi-ticker karşılaştırma agent

**Eklenecek** (~3 saat — bonus özellik):
- `POST /chat-compare` endpoint: 2-3 ticker alır, paralel pipeline çalıştırır.
- Yeni agent: `ComparisonAgent` — 2 tezi karşılaştıran tek paragraf üretir.
- Demo gösterimi: "ASELS vs OTKAR" karşılaştırma → jüri için "vow factor".

### 5.4 `/api/thesis/{id}` enriched response

**Mevcut**: `thesis_rest.py:_thesis_to_dict` minimal. Tool call detayları için ayrı endpoint (`/citations`).

**Eklenecek** (~30 dk):
- `?include=tool_calls,critique` query param ile tek call'da hepsi gelsin.
- Frontend round-trip azalır.

### 5.5 Health endpoint'i zenginleştirme

**Mevcut**: muhtemelen sadece `200 OK`.

**Eklenecek** (~30 dk):
- `/health/detail`: provider chain status (her domain için son hit time), cache hit rate, DB latency, son N pipeline süresi.
- Demo sırasında "sistem canlı, şu kadar pipeline çalıştı" göstermek için.

### 5.6 Demo guard rails

**Eklenecek** (~1 saat):
- `scripts/demo_smoke.py`: 5 BIST ticker'ını sırayla pipeline'dan geçirir, her birinin `had_kaynaksiz_flag=False`, `confidence` ∈ [30, 90] olduğunu doğrular.
- Demo öncesi çalıştır, sahnede sürpriz olmasın.
- CI'a eklenebilir (10 dk run).

---

## 6. GÜVENLİK / DAYANIKLILIK (P3 — hackathon kapsamı dışı ama not)

- **Rate limit**: Gemini API'ye karşı yok. `data/ratelimit.py` var ama provider chain'lerde kullanılmıyor görünüyor. Demo dakikada 3 ticker ile patlayabilir.
- **PII**: `users.email` log'lara düşebilir; bir log redaction katmanı yok.
- **CORS**: `main.py` kontrol edilmeli (görmedim ama frontend localhost'tan bağlanacaksa açık olmalı).

---

## 7. ÖNCELİK MATRİSİ — 6 GÜN İÇİN ÖNERİLEN PLAN

| Gün | Görev | Etki | Süre |
|---|---|---|---|
| **1** | 1.1 `data_quality` formülü düzelt | Confidence anlamlı olur | 30 dk |
| **1** | 1.2 `momentum_score` deterministik Python'a çek | Bearish hisselerde extreme low yok | 1 saat |
| **1** | 1.4 Sector Router LLM fallback'i sil | -3-5s, dead code temizliği | 15 dk |
| **1** | 1.5 Memory prompt sil | Dead code temizliği | 5 dk |
| **1** | 2.5 Timeout 200s'e çek | Tutarlılık | 10 dk |
| **2** | 2.2 `extract_structured` regex parser | -5-15s, deterministic | 1 saat |
| **2** | 2.3 Validator retry oranı ölç + prompt sıkılaştır | Retry %30→%10 | 1 saat |
| **2** | 4.2 `_FALLBACK_MD` stream etme | Demo riski sıfır | 30 dk |
| **2** | 5.6 `demo_smoke.py` | Demo güvencesi | 1 saat |
| **3** | 1.3 News sentiment ham → `news_macro` formülü dinamik | Macro sinyali anlamlı | 2 saat |
| **3** | 3.1 Base rate seed data | Devil's Advocate güçlenir | 1.5 saat |
| **3** | 3.2 Devil → Synth UUID köprüsü | Bear kaynaksız %33→%10 | 1 saat |
| **3** | 3.3 Macro prompt observation kuralları | Macro citation'lı | 30 dk |
| **4** | 2.1 Tool-level paralelizasyon | -25-30s, büyük WOW | 4 saat |
| **4** | 4.5 PgBouncer | DB connection rahatlığı | 15 dk |
| **5** | 5.2 Backtest pipeline + 5.3 multi-ticker compare | Demo pitch | 4-6 saat |
| **6** | Dry-run, fixture testleri, UI integration | Demo gün öncesi | full day |

---

## 8. NE EL SÜRMEMELİ

Sürede sıkışıkken aşağıdakilere dokunmak **negatif beklenen değerli**:

- **Strands tool wrapper double-layer** (`4.4`): refactor maliyeti yüksek, mevcut çalışıyor.
- **Squad prompt'ları konsolide etme** (`3.4`): 6×80 satır okunabilir; konsolide etmek hackathon scope'unda yarardan çok regresyon riski.
- **WSHub Redis migration** (`4.1`): tek worker yeter, dokümante edildi.
- **Strands → başka framework migrasyonu**: 3 günde olmaz.

---

## 9. JÜRİ ANLATIMI İÇİN HAZIR HAT

Bu rapor optimize edildiğinde demo'da söyleyebileceklerin:

> "ThesisForge **7 agent + Devil's Advocate** mimari ile çalışıyor. Her cümlenin arkasında bir tool call var, validator 3 katmanda doğruluyor: regex parse → DB lookup → numeric sanity. Output denetlenebilir, halüsinasyon yok.
>
> Confidence ağırlıklı 6 bileşen — data_quality, technical, fundamental, news_macro, memory_base, devil_inverse — ve conservative modda 70'te cap'leniyor.
>
> **Geçen 30 testin %X'inde confidence>70 olanlar correct çıktı** [5.2 yapılırsa].
>
> Pipeline 130s'in altında, 5 worker tool paralel çalışıyor, WebSocket ile gerçek zamanlı stream. Tek Gemini Pro çağrısı Synthesizer'da; geri kalan 6 ajan Flash. Cost tahmini tez başına ~$0.04."

Bu hattı tutmak için **1.1, 1.2, 1.3, 2.1, 3.1, 5.2** kritik. Diğerleri kalite/temizlik.
