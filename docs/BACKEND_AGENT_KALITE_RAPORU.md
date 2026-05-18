# Backend Agent Kalite Raporu — ThesisForge

**Tarih**: 2026-05-19  
**Kapsam**: `backend/app/agents`, `backend/app/agents/prompts`, `backend/sector_map.yaml`, citation validator, confidence skoru, data provider zinciri ve backend unit/smoke kanıtları  
**Amaç**: Frontend tamamlandıktan sonra backend agent katmanında tez doğruluğunu, skor güvenliğini, squad sınıflandırmasını ve model/provider sağlığını değerlendirmek.

---

## 1. Yönetici Özeti

Backend agent omurgası demo seviyesinde çalışır durumda: çoklu agent DAG akışı, deterministic teknik skor post-processor'ı, citation validator, memory, Devil's Advocate ve squad-spesifik fundamental prompt'lar mevcut. Son smoke çıktılarında 5 örnek ticker başarıyla tamamlanmış, süreler 93-110 saniye bandında kalmış ve `had_kaynaksiz_flag=false` dönmüştür.

Ancak "tez doğru mu?" sorusunun cevabı hâlâ sadece `had_kaynaksiz_flag=false` ile güvence altına alınamaz. Citation validator UUID varlığını iyi kontrol ediyor, fakat numeric mismatch artık soft signal; yani yanlış sayının doğru UUID ile kaynaklanması demo akışını bozmayabilir. Ayrıca `sector_map.yaml` içinde 34 duplicate ticker var ve unit testte `SELEC` Healthcare beklenirken Retail'e düşüyor. Bu, yanlış squad prompt'u seçilmesine ve yanlış fundamental çerçeveyle tez üretilmesine neden olabilir.

**Öncelik sırası**:

1. **P0**: Duplicate ticker/squad mapping düzeltmesi ve duplicate kontrol testi.
2. **P0**: Citation kalite metriklerinin raporlanması: numeric issue oranı, kaynaklı claim oranı, catalyst kaynak oranı, retry oranı.
3. **P1**: Confidence skorunu veri tazeliği, live/fixture ayrımı ve citation kalitesiyle kalibre etmek.
4. **P1**: Gemini 3.1 Pro Preview için kontrollü A/B test; doğrudan prod default yapılmamalı.
5. **P2**: Smoke raporuna provider hit/fallback oranı eklemek.

---

## 2. Mevcut Durum

### 2.1 Çözülen veya iyileşen eski bulgular

Önceki `docs/BACKEND_ANALIZ_RAPORU.md` içindeki bazı P0/P1 riskler kodda çözülmüş görünüyor:

| Eski bulgu | Güncel durum | Kanıt |
|---|---|---|
| Tool'lar sequential çalışıyor | **Çözüldü** | `runtime.py` artık `ConcurrentToolExecutor()` kullanıyor; technical/fundamental worker tool sonuçlarını önceden paralel topluyor. |
| `momentum_score` LLM aritmetiğine bağlı | **Çözüldü** | `technical_worker.py` RSI/MACD/relative strength üzerinden deterministic skor hesaplayıp LLM skorunu override ediyor. |
| `data_quality` total==success nedeniyle hep anlamsız | **Kısmen çözüldü** | `EXPECTED_TOOL_TOTAL=18` denominator olarak kullanılıyor; fail path tool log insert ediyor. Ancak demo run'larda hâlâ sık 100 görülebilir. |
| `news_macro` binary 40/60 | **Çözüldü** | `MacroContextOutput.sentiment_score` var; orchestrator bunu 0-100 bandına çeviriyor. |
| `extract_structured` ikinci LLM çağrısı | **Çözüldü** | `synthesizer.py` deterministic regex parser kullanıyor. |
| Sector router LLM fallback dead code | **Çözüldü** | `sector_router.py` rule-based çalışıyor. |
| Devil's Advocate kaynak eşleştirme zayıf | **Kısmen çözüldü** | `Critique.citation_call_ids` eklendi; kalite hâlâ prompt uyumuna bağlı. |

### 2.2 Güncel agent akışı

- `orchestrator.py`: sector, macro, memory ve technical branch'lerini paralel başlatıyor; sector tamamlanınca fundamental worker başlıyor; tech/fund/memory sonrası Devil's Advocate; macro beklenip synthesizer/validator/persist akışı çalışıyor.
- `technical_worker.py`: tool sonuçlarını paralel topluyor, observation citation id'lerini normalize ediyor, pattern observation eksikse deterministic ekliyor, momentum skorunu Python'da hesaplıyor.
- `fundamental_worker.py`: squad prompt'una göre analiz üretiyor, tool sonuçlarını pre-collected JSON olarak LLM'e veriyor, citation id normalize ediyor.
- `macro_context.py`: Pro modelle structured output üretiyor; macro observations ve `sentiment_score` bekleniyor.
- `devils_advocate.py`: Pro model + 3 tool ile risk, pushback, base rate ve citation id listesi üretiyor.
- `synthesizer.py`: Pro modelle markdown yazıyor; sonra citation repair/drop ve deterministic structured extract uygulanıyor.

Bu akış mimari olarak makul; ana risk artık agent orkestrasyonundan çok sınıflandırma, doğruluk ölçümü ve skor kalibrasyonunda.

---

## 3. Kritik Bulgular

### P0 — Squad sınıflandırması duplicate ticker nedeniyle deterministik ama yanlış olabilir

`sector_map.yaml` içinde 28 squad ve 907 unique ticker görünüyor; ayrıca 34 duplicate ticker var. Lookup ilk eşleşen squad'ı döndürdüğü için YAML sırası business kararına dönüşüyor.

Örnek duplicate'ler:

| Ticker | İlk squad | Sonraki squad |
|---|---|---|
| `SELEC` | Retail | Healthcare |
| `PRKME` | Energy | Mining |
| `ORGE` | Energy | Construction |
| `GRSEL` | Retail | Transportation |
| `KOPOL` | Mining | Chemical |
| `DOCO` | Tourism | Industrial |
| `DCTTR` | Retail | Generic |

Unit testte somut kırılım:

```text
FAILED backend/tests/unit/test_tool_decorator.py::test_squad_for_ticker_parametric[SELEC-Healthcare]
AssertionError: assert 'Retail' == 'Healthcare'
```

**Etki**: Yanlış squad seçilirse yanlış fundamental prompt, yanlış `key_metrics`, yanlış peer listesi ve yanlış base-rate/memory filtrelemesi kullanılır. Bu doğrudan tez kalitesini bozar.

**Öneri**:

- `sector_map.yaml` içinde duplicate ticker bırakılmasın veya explicit `ticker_overrides` bloğu eklensin.
- `squad_for_ticker()` önce override'a, sonra squad listelerine baksın.
- Duplicate kontrol testi eklensin: izin verilen override dışında duplicate varsa test fail etsin.
- Domain kararı gereken ticker'lar için kısa not yazılsın: `SELEC=Healthcare`, `PRKME=Mining` gibi.

### P0 — `had_kaynaksiz_flag=false` tek başına tez güvenliği değildir

Validator üç katmanlı çalışıyor:

1. `[kaynak: <uuid>]` regex parse.
2. UUID'nin aynı thesis tool log'unda varlığı.
3. Sayısal claim'in tool result içinde desteklenip desteklenmediği.

Güncel kodda numeric mismatch `numeric_issues` olarak raporlanıyor ama `had_kaynaksiz_flag` karartmıyor. Bu demo akışı için doğru bir pragmatik karar olabilir; çünkü türetilmiş metriklerde false positive üretme riski var. Fakat kalite raporu açısından kritik fark şu:

- **UUID gerçek**: claim kaynaklı sayılır.
- **Sayı yanlış veya başka context'ten türemiş**: yalnızca `numeric_issues` içinde görünür.
- **Final kullanıcı sinyali**: çoğu yerde sadece `had_kaynaksiz_flag` görünür.

**Etki**: Yanlış sayı + doğru UUID kombinasyonu kullanıcıya temiz rapor gibi görünebilir.

**Öneri**:

- `ValidationReport` çıktısından kalite metrikleri hesaplanmalı:
  - `claim_count`
  - `cited_claim_count`
  - `uncited_claim_count`
  - `numeric_issue_count`
  - `numeric_issue_rate`
  - `catalyst_count`
  - `catalyst_cited_count`
  - `citation_retry_count`
- `update_thesis_synthesis()` içine bu audit metrikleri JSON olarak yazılmalı veya ayrı `citation_audit` alanı eklenmeli.
- UI ve smoke raporu `had_kaynaksiz_flag` yanında "citation health" göstermeli.

### P1 — Confidence skoru veri kalitesi dışında kalite sinyalini yeterince taşımıyor

Mevcut ağırlıklar:

```text
data_quality 0.25
technical    0.20
fundamental  0.20
news_macro   0.15
memory_base  0.10
devil_inverse 0.10
```

Bu iyi bir başlangıç; fakat `data_quality` sadece başarılı tool çağrı sayısı / beklenen tool sayısı üzerinden hesaplanıyor. Bu şunları ayırmıyor:

- Live provider mı fixture mı?
- Veri kaç saat/gün eski?
- Tool result boş ama başarılı mı?
- Citation numeric issue var mı?
- Catalyst'ler kaynaklı mı?
- Aynı tool result farklı iddialar için yanlış kullanılmış mı?

**Öneri**:

- `data_quality` alt bileşenlere ayrılsın:
  - `tool_success_rate`
  - `live_source_rate`
  - `freshness_score`
  - `citation_health`
  - `non_empty_payload_rate`
- Final skorda `citation_health` en az %10 ağırlıkla etkili olsun veya `data_quality` içinde çarpan olarak kullanılsın.
- `numeric_issue_rate > 0.2` ise confidence cap uygulansın: örn. final skor en fazla 70.

### P1 — Catalyst üretimi hâlâ kalite açısından en hassas bölüm

Synthesizer prompt'u catalyst kaynak kuralını sıkı tanımlıyor ve repair fonksiyonu catalyst'lere rastgele UUID atamıyor. Bu doğru. Ancak eski smoke örneklerinde catalyst'lerin `call_id=None` dönebildiği görülmüş; yeni smoke sonuçlarında `had_kaynaksiz_flag=false` olsa bile catalyst kaynak oranı ayrıca raporlanmıyor.

**Öneri**:

- Structured extract sonucu catalyst kaynak oranı hesaplanmalı.
- Acceptance kriteri: en az 2 catalyst, en az %75 kaynaklı catalyst; eğer kaynak yoksa catalyst sayısı düşürülsün ama yanlış kaynak kullanılmasın.
- Catalyst tarihleri bugünün tarihine göre geçmişe düşmemeli; bunu test eden unit veya smoke assertion eklenmeli.

---

## 4. Skor ve Citation Güvenliği

### 4.1 Tez doğru üretiliyor mu?

Mevcut sistem "tamamen serbest LLM raporu" üretmiyor; agent outputs, tool logs, citation ids ve validator ile sınırlandırılmış bir rapor üretiyor. Bu doğru yönde bir mimari. Yine de "doğru tez" için üç ayrı kalite seviyesi var:

| Seviye | Bugünkü durum | Risk |
|---|---|---|
| Kaynak var mı? | İyi | UUID validator güçlü. |
| Kaynak doğru claim'i destekliyor mu? | Orta | Numeric mismatch soft; semantic mismatch ölçülmüyor. |
| Yatırım tezi isabetli mi? | Zayıf/ölçülmemiş | Backtest ve outcome takip altyapısı var ama karar kalibrasyonu sınırlı. |

Bu nedenle raporların kaynaklı olması ile yatırım tezinin gerçekten doğru olması karıştırılmamalı. Sistem şu an "denetlenebilir tez" üretmeye daha yakın; "isabetli yatırım tahmini" için backtest ve kalibrasyon metrikleri gereklidir.

### 4.2 Önerilen citation health modeli

Her tez için şu audit skorunu üretmek yeterli olur:

```text
citation_health =
  0.40 * cited_claim_rate
+ 0.25 * (1 - numeric_issue_rate)
+ 0.20 * catalyst_cited_rate
+ 0.15 * (1 - retry_required_rate)
```

Bu skor:

- `confidence_breakdown` içine eklenebilir.
- `data_quality` ile çarpan olarak kullanılabilir.
- UI'da "Kaynak Sağlığı" olarak gösterilebilir.

### 4.3 Devil's Advocate ve base rate güvenliği

`base_rate_check` DB'de sonuçlanmış geçmiş tezlere bakıyor. Seed/demo verisi varsa iyi çalışır; boş DB'de `success_rate_pct=None` döner. Devil's Advocate prompt'u bunu risk olarak yazabilir ama bu gerçek base rate değildir.

**Öneri**:

- `base_rate_check` çıktısında `sample_size` küçükse uyarı seviyesi düşürülsün.
- `total_completed < 10` ise "base rate zayıf örneklem" etiketi üretilsin.
- Confidence hesaplamasında memory/base-rate etkisi sample size ile ağırlıklandırılsın.

---

## 5. Gemini 3.1 Geçiş Değerlendirmesi

### 5.1 Güncel model durumu

Kodda varsayılan model ayarları:

```python
GEMINI_MODEL_PRO = "gemini-2.5-pro"
GEMINI_MODEL_FLASH = "gemini-2.5-flash"
GEMINI_EMBED_MODEL = "text-embedding-004"
```

Google'ın güncel Gemini model dokümanında `gemini-3-pro-preview` için shutdown/deprecation uyarısı var; güncel Pro karşılığı `gemini-3.1-pro-preview` olarak görünüyor. `gemini-3.1-pro-preview` structured outputs, function calling, thinking ve uzun context destekliyor; agentic workflow ve precise tool usage için optimize edildiği belirtiliyor.

Kaynaklar:

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.1 Pro Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview)

### 5.2 Kullanmalı mıyız?

**Evet, ama doğrudan prod default olarak değil.** ThesisForge için Pro path kalite-kritik:

- Synthesizer
- Devil's Advocate
- Macro structured output

Bu ajanlarda Gemini 3.1 Pro Preview daha iyi tool disiplinine ve factual consistency'ye katkı verebilir. Ancak preview model olduğu için rate limit, latency ve davranış değişimi riski var.

**Önerilen geçiş**:

1. `GEMINI_MODEL_PRO=gemini-3.1-pro-preview` sadece local/demo A/B testte denensin.
2. `GEMINI_MODEL_PRO_FALLBACK=gemini-2.5-pro` benzeri fallback ayarı eklensin.
3. A/B metrikleri karşılaştırılsın:
   - latency
   - citation retry oranı
   - numeric issue oranı
   - catalyst source oranı
   - structured output fail oranı
   - total cost
4. Eğer 3.1 Pro retry/numeric issue oranını anlamlı düşürürse Pro path'te kullanılabilir.

### 5.3 Gemini 3.1 beklenen kalite etkisi

Muhtemel iyileşme alanları:

- UUID disiplininde daha az hata.
- Devil's Advocate'te daha tutarlı karşı argüman.
- Synthesizer'da daha iyi claim-source eşleştirme.
- Uzun context'te daha az karışma.

Muhtemel riskler:

- Preview endpoint deprecate olabilir.
- Daha yüksek latency veya rate limit.
- Strands `GeminiModel` wrapper'ında yeni endpoint davranışı test gerektirebilir.
- Daha iyi yazı kalitesi her zaman daha doğru finansal tez anlamına gelmez; validator metrikleriyle ölçülmelidir.

---

## 6. Kütüphane ve Provider Sağlığı

### 6.1 Kullanılan ana kütüphaneler

| Kütüphane | Kullanım | Durum |
|---|---|---|
| `strands-agents[gemini]` | Agent runtime, structured output, tool executor | Çalışır görünüyor; model değişimiyle regression testi gerekir. |
| `google-genai` | Gemini embedding ve model client | Çalışır görünüyor; API key yoksa embedding stub fallback var. |
| `yfinance` | fiyat, endeks, temettü, Brent | Demo için yeterli; canlı veri kesintisi/fallback oranı izlenmeli. |
| `isyatirimhisse` | finansal tablolar ve oranlar | Kritik provider; payload boşluğu kalite skoruna yansımalı. |
| `pykap` | KAP şirket bildirimleri ve raporlar | Sağlıklı görünür ama haber/KAP boşluğu ayrı raporlanmalı. |
| `borsapy` | analist verisi | Registry'de var; agent flow içinde aktif rolü sınırlı. |
| `pandas_ta` | teknik indikatörler | Teknik skor için kritik; provider fail olursa momentum nötrleşir. |

### 6.2 Provider zinciri sağlıklı mı?

Registry mimarisi doğru: primary provider başarısız olursa sonraki provider ve fixture fallback deneniyor. Cache key'lerinde finansal oranlar için gün etiketi kullanılması demo tutarlılığı açısından iyi.

Eksik olan şey operasyonel görünürlük:

- Her thesis run için provider hit/fallback sayısı görünmüyor.
- Fixture kullanımı confidence'a yansımıyor.
- Provider result boşsa ama exception fırlatmıyorsa kalite düşmeyebilir.

**Öneri**:

- `ProviderResult` içine veya tool log result metadata'sına `source_type=live|fallback|fixture|stub` eklenmeli.
- Smoke raporu şu satırları içermeli:
  - live provider hit count
  - fallback provider hit count
  - fixture hit count
  - stub embedding usage
  - empty payload count

---

## 7. Öncelikli Yol Haritası

### P0 — 0.5 gün: Squad mapping düzeltmesi

- Duplicate ticker listesi çıkar.
- `ticker_overrides` veya duplicate-free YAML yaklaşımı seç.
- `SELEC=Healthcare` testini geçir.
- Duplicate kontrol testi ekle.
- `squad_for_ticker`, `lookup_sector`, `get_sector_peers`, memory squad filtresi aynı override kararını kullansın.

### P0 — 1 gün: Citation health metrikleri

- Validator sonucundan aggregate audit metrikleri üret.
- `numeric_issues` sadece log'da kalmasın; thesis output veya smoke raporunda görünsün.
- Catalyst kaynak oranı hesapla.
- Retry sayısını ölç.
- Confidence veya UI için `citation_health` alanı ekle.

### P1 — 1 gün: Confidence kalibrasyonu

- `data_quality` alt bileşenlerini ayır.
- Fixture/stub/live ayrımını skora yansıt.
- Numeric issue oranı yüksekse cap veya penalty uygula.
- Base rate sample size küçükse memory/base-rate etkisini düşür.

### P1 — 0.5-1 gün: Gemini 3.1 A/B testi

- Env ile Pro model override denenir: `GEMINI_MODEL_PRO=gemini-3.1-pro-preview`.
- Aynı ticker setiyle 2.5 Pro vs 3.1 Pro karşılaştırılır.
- Default değişikliği ancak retry ve citation metrikleri iyileşirse yapılır.

### P2 — 1 gün: Prompt bakım yapısı

- 28 fundamental prompt için ortak base prompt + squad metric fragment yaklaşımı tasarlanır.
- Her squad sadece sektör metriklerini ve özel yasak/önceliklerini taşır.
- Catalyst kuralları base synthesizer prompt'ta korunur.

---

## 8. Test Kanıtları

### 8.1 Unit test

Çalıştırılan komut:

```bash
.venv/bin/python -m pytest backend/tests/unit
```

Sonuç:

```text
collected 106 items
105 passed
1 failed
```

Fail eden test:

```text
test_squad_for_ticker_parametric[SELEC-Healthcare]
Expected: Healthcare
Actual: Retail
```

Bu test kırılımı backend agent kalitesini doğrudan ilgilendiriyor; çünkü squad prompt seçimi buradan geliyor.

### 8.2 Smoke sonuçları

`demo_smoke_results.json` özeti:

| Ticker | OK | Süre sn | Confidence | Kaynaksız flag | Bull | Bear |
|---|---:|---:|---:|---:|---:|---:|
| ASELS | true | 94.49 | 66.81 | false | 5 | 5 |
| GARAN | true | 108.22 | 46.97 | false | 4 | 5 |
| TUPRS | true | 97.08 | 62.91 | false | 5 | 6 |
| MGROS | true | 93.40 | 64.01 | false | 5 | 5 |
| EREGL | true | 109.78 | 60.16 | false | 6 | 6 |

Bu iyi bir demo sinyali; ancak şu metrikler eksik olduğu için kalite kararı tamamlanmış sayılmaz:

- numeric issue count
- citation retry count
- catalyst source ratio
- provider fallback ratio
- fixture/stub usage

### 8.3 Kabul kriterleri

Kod iyileştirmeleri sonrası minimum kabul:

- `pytest backend/tests/unit/test_tool_decorator.py` yeşil.
- `pytest backend/tests/unit/test_citation_validator.py backend/tests/unit/test_synthesizer.py backend/tests/unit/test_workers.py` yeşil.
- `ASELS`, `GARAN`, `TUPRS` smoke run'larında:
  - `had_kaynaksiz_flag=false`
  - `numeric_issue_rate` raporlanıyor
  - `catalyst_cited_rate` raporlanıyor
  - provider hit/fallback oranı raporlanıyor

---

## 9. Uygulanabilir Checklist

- [ ] `sector_map.yaml` duplicate ticker kararları netleştirilecek.
- [ ] `squad_for_ticker()` override/priority destekleyecek.
- [ ] Duplicate ticker unit testi eklenecek.
- [ ] `ValidationReport` veya thesis persist katmanına citation health metrikleri eklenecek.
- [ ] Smoke raporu numeric issue, retry ve catalyst source oranlarını yazacak.
- [ ] Confidence skoruna citation health ve provider quality etkisi eklenecek.
- [ ] Base rate sample size küçükse skora etkisi azaltılacak.
- [ ] Gemini 3.1 Pro Preview A/B testi env flag ile yapılacak.
- [ ] Provider source type ve fallback oranları tool log/smoke çıktısına yazılacak.
- [ ] Fundamental prompt tekrarları base prompt + squad fragment yapısıyla azaltılacak.

---

## 10. Sonuç

Backend agent sistemi hackathon demosu için sağlam bir noktaya gelmiş: akış paralel, agent çıktıları şemalı, citation mekanizması var, smoke run'lar başarılı. Kalan riskler daha çok "kalite güvence" katmanında: yanlış squad seçimi, citation health'in tek skora indirgenmemesi, confidence'ın veri kaynağı kalitesini yeterince taşımaması ve model geçişinin ölçümsüz yapılması.

İlk uygulanması gereken iş koddan bağımsız görünse de kritiktir: `sector_map.yaml` duplicate kararları netleşmeden bazı hisseler yanlış ajan prompt'uyla analiz edilebilir. İkinci kritik iş, `had_kaynaksiz_flag` yerine daha zengin bir citation health metriğini sistemin ana kalite sinyali yapmak olmalıdır.
