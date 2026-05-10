# ThesisForge — Tam Detaylandırma

Bu cevabı iki ana bölüme ayırdım: önce **ürün/strateji** (problem, kullanıcı, gerçek değer), sonra **teknik tasarım** (mimari, ajanlar, veri akışı, kod iskeleti). İkisi birlikte okunduğunda hem hackathon sunumunda hem de portfolyo açıklamasında kullanabileceğin tam bir storyline çıkıyor.

---

# BÖLÜM 1 — Ürün ve Strateji

## 1.1 Çözülen problem — gerçek hayattan başlayalım

Türkiye'de **6 milyondan fazla** bireysel yatırım hesabı var. Bunların büyük çoğunluğu son 4-5 yılda açıldı (enflasyondan kaçış + döviz kontrolleri kombinasyonu). Yani **piyasaya yeni gelmiş, deneyimsiz, ama parası olan** büyük bir kitle var.

Bu kitle bir hisseyi araştırırken şu noktalardan birinden birini yapıyor:

| Yöntem | Sorun |
|---|---|
| **Sosyal medya / Telegram grupları** | Pump-dump çetelerinin yemi olur, manipülasyona açık |
| **YouTube "borsa hocaları"** | Çoğu sponsorlu, çıkar çatışması, gecikmiş bilgi |
| **Tek bir aracı kurum raporu** | Tek perspektif, kurumun pozisyonuna göre eğimli |
| **Kendi araştırma** | KAP'ı okumayı bilmiyor, finansal tabloyu anlayamıyor, haber + sentiment + teknik üçünü birleştiremiyor |
| **Robo-advisor'lar** | Türkiye'de hemen hemen yok; varsa portföy önerir, **tez üretmez** |

**Asıl sorun:** Bir hisse hakkında **çok-perspektifli, dengeli, kaynaklı** bir görüş üretmek için profesyonel yatırım komitelerinin yaptığı iş gerekir — birden çok analist farklı açılardan bakar, tartışır, sentez yapar. Bu hizmet bireysel yatırımcıya **ulaşmıyor**.

> **ThesisForge'un cümlesi:** *"Profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan AI sistemi."*

Bu cümle önemli, çünkü ThesisForge'u "borsa botu" veya "AI fal bakıcısı" olmaktan ayıran şey **süreci** modellemesi — sadece sonucu değil.

## 1.2 Ne **olmadığını** netleştirmek

Bu kısım demo'da ve sunumda kritik, çünkü judge'lar finansal AI deyince hemen kafalarında bir robo-trader oluşturuyor:

| ThesisForge **DEĞİLDİR** | ThesisForge **AYNEN BUDUR** |
|---|---|
| Bot — kullanıcı yerine işlem yapmaz | **Karar destek sistemi** — kararı kullanıcı verir |
| Tahmin makinesi ("ASELS yarın 75 TL olur") | **Tez üretici** ("Şu varsayımlar doğru çıkarsa yön yukarı") |
| Garanti vaad eden sistem | Belirsizliği **explicit hesaplayan**, güven aralığı veren |
| Tek doğru cevap üretir | **Bull case + Bear case + Anahtar katalizörler** üretir |
| Black box | **Her cümlenin kaynağı görünür** (cite-able) |

Bu konumlandırma hem **regülasyon riskini** azaltır (SPK'nın "yatırım danışmanlığı" tanımına girmemek için kritik), hem **judge psikolojisi** açısından akıllıca: judge'lar AI'dan korkuyorsa "AI insan yerine karar verir"den dolayı korkuyor — sen başta bu korkuyu söndürürsün.

## 1.3 Hedef kullanıcı profilleri

Üç primer persona, her biri demo'da farklı bir senaryoyu temsil eder:

### Persona 1 — **Mehmet, 34, mühendis** ("Hobby Investor")
- BIST'te 6 yıldır var, 7 hisselik portföy
- Maaşının %20'sini yatırıma ayırıyor
- İş yoğun, hisse araştırmaya haftada **1-2 saat** ayırabiliyor
- Şu an: Bloomberg HT izliyor, sosyal medyaya bakıyor, kafası karışık
- **Problem:** Bilgi fazla, sentez zor. *"Hangisi gerçekten önemli?"*
- ThesisForge'da değer: Haftalık 10 dakikada watchlist'inin tezini güncellesin

### Persona 2 — **Zeynep, 27, finans öğrencisi/junior analyst** ("Aspiring Pro")
- CFA Level 1 hazırlanıyor
- Kendi araştırmasını yapıyor ama her açıyı tek başına kapsayamıyor
- KAP'ı okumayı **biliyor**, ama 5 yıllık bilanço analizini **manuel** yapmak çok zaman alıyor
- **Problem:** Verim. Profesyonel iş akışını taklit etmek istiyor ama tek başına
- ThesisForge'da değer: Kendi tezini yazmadan önce "AI komite ne demiş" diye bakar, kör noktalarını yakalar

### Persona 3 — **Ali Bey, 56, emekli devlet memuru** ("Conservative Saver")
- Emeklilik birikimini değerlendirmek istiyor
- Temettü hisselerine ilgili (BIMAS, AKBNK, EREGL gibi)
- Teknik analizi **anlamıyor ve istemiyor** — temel hikaye yeterli
- **Problem:** Yanlış hisseye girip sermayeyi yakma korkusu
- ThesisForge'da değer: "Conservative mode" — bear case'i daha ağırlıklı görsün, temettü güvenliği vurgulansın

### Sekonder persona — **Junior PM / Analyst, kurumsal**
Bu hackathon hedef kitlesi değil ama **B2B genişlemesi** için kritik. Aracı kurumlarda junior analistler ThesisForge'u **brifing aracı** olarak kullanabilir — sabah toplantısı için 5 hisselik özet hazırlayan asistan. Bu hikayeyi bilet kesmeye gerek yok, ama judge sorduğunda *"B2B opsiyonu da var"* diyebilmek değerli.

## 1.4 Gerçekten kullanılabilir mi? — dürüst değerlendirme

Bu sorunun cevabı evet veya hayır değil, **"hangi formda ve hangi sınırlar içinde"** sorusunun cevabı.

### ✅ Gerçekten değer üreten kısımlar

**1. Bilgi sentezi** — *(Yüksek güvenilirlik)*
Bir insan analistin yaptığı bilgi toplama-özetleme işini AI **ucuz, hızlı, paralel** yapar. Bu kısım **kanıtlanmış teknoloji** — perplexity, deep research vb. zaten çalışıyor. ThesisForge'un bu kısmı %100 gerçek değer üretir.

**2. Kör nokta yakalama (Devil's Advocate)** — *(Orta-yüksek güvenilirlik)*
Yatırım kararlarındaki en büyük insan hatası **confirmation bias**. AI'a "bu tezin tersini savun" demek bireyin kendi kafasında yapamadığı bir egzersizi yaptırır. Akademik literatür de [premortem analysis](https://hbr.org/2007/09/performing-a-project-premortem) ve [red-teaming](https://en.wikipedia.org/wiki/Red_team) tekniklerinin karar kalitesini iyileştirdiğini gösteriyor.

**3. Yapılandırılmış sunum** — *(Yüksek güvenilirlik)*
Bull/Bear/Catalysts framework'ü zaten **Bridgewater, Goldman, Morgan Stanley** gibi kurumların kullandığı standart formattır. AI bu yapıyı dayatır → kullanıcı dağınık bilgi yerine net seçenekler görür.

**4. Geçmişle karşılaştırma (Memory)** — *(Orta güvenilirlik)*
*"Bu tür pattern son 12 ayda kaç kere doğru çıktı?"* sorusu **base rate awareness** sağlar. Bu psikolojik anchor kullanıcıyı aşırı güvenden korur.

### ⚠️ Limitleri net söylemek lazım

**1. Tahmin değil tez** — Sistem *"hisse yükselir"* demez, *"şu varsayımlar tutarsa yukarı yön baskın"* der. Kullanıcı varsayımları kendi değerlendirir.

**2. Veri tazelği** — KAP, news, sentiment verileri gecikmeli. ThesisForge **HFT/intraday için değil**, swing-trade ve uzun vadeli yatırım için.

**3. Lisans/regülasyon** — Türkiye'de **yatırım danışmanlığı SPK lisansı** ister. Bu yüzden ThesisForge "**bilgi sunumu ve eğitim aracı**" konumlandırmasıyla yaşar, "öneri" ile değil. Her cümle disclaimer'lı olmalı.

**4. Halüsinasyon riski** — Finansal sayılarda bir rakam yanlış olursa felaket. **Citation-grounded mimari** zorunlu (ileride detaylandıracağım — her sayı kaynak chunk'a bağlı).

**5. Backtest tuzakları** — Tarihsel performans gelecek garantisi değil. Sistem bu uyarıyı kullanıcıya **görünür** tutmalı.

### Kullanılabilirlik notu — bir TPM gözüyle

ThesisForge'u "ürünleştirilebilir mi?" sorusunun cevabı **evet, ama belirli bir model ile**:

- **B2C SaaS (Türkiye)**: Aylık 99–149 TL premium subscription. KAP/yfinance ücretsiz veri kaynakları sayesinde unit economics çalışır.
- **B2B (aracı kurumlar)**: Junior analyst tool olarak satılır, white-label edilir. Kurum başı yıllık 50-200K TL.
- **Hibrit**: Free tier (3 sorgu/gün) + Pro tier — fintech klasik freemium modeli.

Bu detaylar sunumun "ürünleştirme" slaytı için sana hazır içerik. Hackathon judge'ları ürün vizyonuna pozitif yanıt verir.

## 1.5 Rakip analizi — neyle yarışıyoruz

| Rakip | Ne yapıyor | ThesisForge'un farkı |
|---|---|---|
| **Mynet Finans, Bigpara** | Haber + grafik aggregator | Sentez yok, kullanıcı kendi yapar |
| **Foreks, Matriks** | Profesyonel terminal | Pahalı (binlerce TL), retail değil |
| **Aracı kurum raporları** | Profesyonel analiz | Geç gelir, tek perspektif |
| **Türk fintech botları** (varsa) | Genel tavsiye, basit | Multi-agent ve **memory yok** |
| **ChatGPT/Claude direkt** | Genel amaçlı | Türk piyasasına özel değil, tool yok, hafıza yok |
| **HashTrade (kendi projen)** | Crypto + execution | Borsa değil, **execution** odaklı |

**ThesisForge'un savunulabilir farkı:** *Türk piyasası odaklı + multi-agent komite süreci + memory + her sayının kaynağı görünür.* Bu kombinasyon piyasada **yok**.

---

# BÖLÜM 2 — Teknik Tasarım

## 2.1 Üst seviye sistem mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRESENTATION                           │
│   Next.js (PWA) — Watchlist | Chat | Thesis Viewer | Backtest   │
└──────────────────────┬──────────────────────────────────────────┘
                       │  WebSocket (agent thinking stream)
                       │  REST (CRUD, history)
┌──────────────────────┴──────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│              FastAPI + Strands Orchestrator                     │
└──┬────────────────────────────────────────┬─────────────────────┘
   │                                        │
┌──┴───────────────┐                ┌───────┴────────────────────┐
│  AGENT LAYER     │                │   DATA & TOOL LAYER        │
│  (Strands)       │                │                            │
│                  │                │  • KAP scraper             │
│  • Orchestrator  │ ←──tools──→    │  • yfinance / TwelveData   │
│  • Macro         │                │  • TA-Lib indikatörler     │
│  • Sector router │                │  • News scraper (Mynet,    │
│  • Workers (×4)  │                │    Bloomberg HT)           │
│  • Devil's Adv.  │                │  • Sentiment scorer        │
│  • Memory        │                │  • TCMB EVDS               │
│  • Synthesizer   │                │  • Backtest engine         │
│  • Backtest val. │                │                            │
└──┬───────────────┘                └────────────────────────────┘
   │
┌──┴────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                          │
│  PostgreSQL (theses, users, watchlist)                        │
│  ChromaDB (embedded thesis memory, RAG context)               │
│  Redis (cache + agent state + queue)                          │
│  S3/MinIO (reports, PDF exports)                              │
└───────────────────────────────────────────────────────────────┘
```

### Mimari kararların gerekçeleri

**Neden FastAPI?** Async-native, WebSocket native (agent thinking stream için kritik), Python ekosisteminde Strands ile birinci sınıf entegrasyon, OpenAPI docs otomatik.

**Neden PostgreSQL + ChromaDB ayrı?** Yapılandırılmış veriler (kullanıcı, watchlist, tez kaydı) PostgreSQL'de — ilişkisel sorgulara açık. Embedding/semantic search gerektirenler (geçmiş tezlerle anlamsal benzerlik) ChromaDB'de. Hibrit RAG.

**Neden Redis?** Üç ayrı görev: (1) Strands agent state cache, (2) yfinance/KAP rate-limit cache (15dk TTL), (3) WebSocket pub/sub.

**Neden Next.js?** PWA desteği out-of-the-box (HashTrade'den tecrüben var), server-side rendering opsiyonel, mobile-first kolay.

## 2.2 Strands ile multi-agent pattern seçimi

Strands'in [4 multi-agent pattern](https://strandsagents.com/)'i var: **Agent-as-Tool, Swarm, Graph, Workflow**. ThesisForge için **hibrit** kullanacağız:

| Bölüm | Pattern | Neden |
|---|---|---|
| Sector Router → Worker selection | **Graph** | Conditional branching var (sektöre göre farklı squad) |
| Worker'lar paralel (Teknik+Temel+Sentiment) | **Agent-as-Tool** (parallel) | Bağımsız çalışırlar, sonuç orchestrator'a döner |
| Devil's Advocate ↔ Workers | **A2A protocol** | Devil's Advocate worker'lara kontra soru sorabilmeli |
| Synthesizer | Tek ajan + structured output | Ne kadar deterministik çıktı o kadar iyi |
| Memory check | **Tool call** | Stateless, bir DB sorgusundan ibaret |

## 2.3 Ajan kataloğu — her birinin **detaylı** rolü

### Agent 0: Macro Context Agent (Sürekli çalışan worker)

**Rol:** Her tez talebinden bağımsız olarak **sürekli güncel** Türk makro durumunu özetler. Tüm diğer ajanlara context olarak verilir.

**Tools:**
- `get_tcmb_indicators()` → faiz, enflasyon, kur (TCMB EVDS API)
- `get_bist_index_state()` → BIST 30/100 trend, hacim
- `get_global_signals()` → S&P 500, VIX, USD endeksi, petrol
- `get_recent_macro_news()` → son 7 gün makro haberlerinin özeti

**Prompt iskeleti:**
```
Sen bir Türk makro ekonomi analistisin. Görevin son 7 günün makro 
durumunu BIR PARAGRAFTA özetlemek. Şunları kapsa:
- Faiz/enflasyon eğilimi
- USD/TRY ve EUR/TRY trendi
- BIST genel havası
- Küresel risk iştahı

Her cümlenin sonuna [kaynak: tool_adı] etiketi koy.
```

**Caching stratejisi:** Bu ajanın çıktısı **15 dakikada bir** yenilenir, Redis'te tutulur. Her tez çağrısında baştan üretmek lüks.

**Model seçimi:** Gemini 2.5 Flash (hızlı, ucuz, makro özet için yeterli)

---

### Agent 1: Orchestrator

**Rol:** Kullanıcı sorgusunu alır, **ne yapılacağını planlar**, alt-ajanları tetikler, çıktıları toplar.

**Sorumluluğu:**
1. Kullanıcı niyetini anla (analiz mi, soru cevap mı, watchlist güncellemesi mi?)
2. Hisse ticker'ını valide et
3. Hangi sektör squad'ının çalışacağına karar ver (Sector Router'a delege)
4. Worker'lara paralel görev dağıt
5. Devil's Advocate'i tetikle
6. Synthesizer'a gönder
7. Memory'e kaydet

**Tools:**
- `validate_ticker(symbol)` → BIST'te var mı?
- `dispatch_workers(squad_name, ticker, depth)` → paralel worker invocation
- `get_macro_context()` → Macro Agent'tan güncel context
- `save_thesis(thesis_obj)` → DB'ye kaydet

**Pseudo-flow:**
```python
async def orchestrate(user_query: str):
    intent = await self.classify_intent(user_query)
    if intent == "thesis":
        ticker = self.extract_ticker(user_query)
        sector = await self.sector_router.classify(ticker)
        squad = self.get_squad(sector)
        macro = await self.cache.get_macro_context()
        
        # Paralel worker invocation
        worker_results = await asyncio.gather(*[
            squad.technical.analyze(ticker, macro),
            squad.fundamental.analyze(ticker, macro),
            squad.sentiment.analyze(ticker, macro),
        ])
        
        # Devil's Advocate (sequential, worker output'u ister)
        critique = await self.devils_advocate.critique(
            ticker, worker_results
        )
        
        # Memory check
        history = await self.memory.find_similar(ticker, worker_results)
        
        # Synthesis
        thesis = await self.synthesizer.compose(
            ticker, worker_results, critique, history, macro
        )
        
        await self.memory.save(thesis)
        return thesis
```

**Model seçimi:** Gemini 2.5 Flash — orchestrator deep reasoning gerektirmez, daha çok routing/dispatch yapar.

---

### Agent 2: Sector Router

**Rol:** Hisseyi sektöre göre sınıflandırır ve doğru "squad"'ı seçer.

10 günlük scope için **3 squad** yeterli:
1. **Banking Squad** (GARAN, AKBNK, ISCTR, YKBNK, HALKB, VAKBN)
2. **Defense/Industrial Squad** (ASELS, OTKAR, TUPRS, EREGL, KCHOL)
3. **Retail/Consumer Squad** (BIMAS, MGROS, SOKM, ULKER, CCOLA)

Hisseler bu squad'lardan birine düşmüyorsa **Generic Squad** fallback.

**Squad'lar arasındaki fark:** Worker'ların `system_prompt`'ı farklı! Banking ajanı NIM, NPL, capital adequacy düşünür; Defense ajanı backlog, ihale süreci, geo-political risk düşünür. Aynı kod, farklı prompt.

**Tools:**
- `lookup_sector(ticker)` → BIST sektör mapping (statik tablo)
- `select_squad(sector)` → squad nesnesi döner

**Model seçimi:** Gemini 2.5 Flash-Lite — bir sınıflandırma görevi, ucuz.

---

### Agent 3: Technical Analyst Worker

**Rol:** Hissenin son 90 günlük fiyat/hacim verisini analiz eder.

**Görev kapsamı:**
- Trend yönü (kısa, orta, uzun vade)
- Anahtar destek/direnç seviyeleri
- RSI, MACD, hacim divergence
- Pattern detection (kafa-omuz, üçgen, bayrak vs)
- Volatilite (ATR, Bollinger Band genişliği)
- Sektör endeksine göre relative strength

**Tools:**
```python
@tool
def get_ohlcv(ticker: str, period: str = "90d") -> pd.DataFrame:
    """Günlük OHLCV verisi döner."""
    return yf.Ticker(f"{ticker}.IS").history(period=period)

@tool
def calculate_indicators(ohlcv: pd.DataFrame) -> dict:
    """RSI, MACD, BB, ATR hesaplar."""
    return {
        "rsi": talib.RSI(ohlcv.Close, 14)[-1],
        "macd": talib.MACD(ohlcv.Close)[-1],
        "bb": talib.BBANDS(ohlcv.Close)[-1],
        "atr": talib.ATR(...)
    }

@tool
def detect_patterns(ohlcv: pd.DataFrame) -> list[Pattern]:
    """Pattern recognition. TA-Lib'in 60+ pattern fonksiyonu."""
    
@tool
def find_support_resistance(ohlcv: pd.DataFrame, lookback: int = 90) -> dict:
    """Pivot-based support/resistance."""

@tool
def relative_strength(ticker: str, benchmark: str = "XU100") -> float:
    """Sektör endeksine göre güç."""
```

**Çıktı şeması (structured output):**
```python
class TechnicalAnalysis(BaseModel):
    trend_short: Literal["up", "down", "sideways"]
    trend_long: Literal["up", "down", "sideways"]
    key_levels: list[Level]  # support/resistance
    momentum_score: float  # -1 to +1
    patterns_detected: list[str]
    notable_observations: list[Observation]
    citations: dict[str, ToolCall]  # her observation hangi tool çıktısından
```

**Prompt iskeleti:**
```
Sen kıdemli bir teknik analistsin. {ticker} için son 90 günlük 
verilere dayalı teknik analiz yap.

KURALLAR:
1. Her gözlemini tool çıktısına BAĞLA
2. Spekülasyondan kaçın - "RSI 71'de" derken kaynağını göster
3. Pattern declare etmeden önce TA-Lib'in pattern fonksiyonunu ÇAĞIR
4. Sonuç: structured JSON (TechnicalAnalysis schema)

Kullanılabilir tools: {tool_list}
```

**Model seçimi:** Gemini 2.5 Flash — sayı ağırlıklı, hızlı, tool-call yoğun.

---

### Agent 4: Fundamental Analyst Worker

**Rol:** Şirketin finansal sağlığı, değerleme, sektör pozisyonunu analiz eder.

**Görev kapsamı:**
- Son 4 çeyrek finansal tablolar
- Temel oranlar (P/E, P/B, ROE, ROA, D/E, EBITDA margin)
- Büyüme trendi (gelir, kâr, FAVÖK)
- Peer comparison (sektör arkadaşlarıyla)
- Önemli KAP bildirimleri (özel durum, yönetim değişiklikleri)
- Temettü geçmişi

**Tools:**
```python
@tool
def fetch_kap_filings(ticker: str, days: int = 90) -> list[Filing]:
    """KAP'tan son N günün bildirimleri."""

@tool
def get_financial_statements(ticker: str, periods: int = 4) -> Financials:
    """Son N çeyrek gelir/bilanço/nakit akış."""

@tool
def compute_ratios(financials: Financials) -> dict:
    """20+ standart oran."""

@tool
def get_sector_peers(ticker: str, n: int = 5) -> list[str]:
    """Aynı sektörden peer'lar."""

@tool
def compare_to_peers(ticker: str, peers: list[str], metrics: list[str]) -> pd.DataFrame:
    """Yan yana metrik karşılaştırma."""

@tool
def get_dividend_history(ticker: str, years: int = 5) -> list[Dividend]:
    """Geçmiş temettü ödemeleri."""
```

**Squad'a göre özelleşme örneği — Banking Worker:**
Banking sektöründeki Fundamental Worker'ın system prompt'una eklenir:
```
Sen bir BANKACILIK SEKTÖRÜ uzmanısın. Standart oranların yanında 
şunlara mutlaka bak:
- Net Faiz Marjı (NIM)
- TGA (Takipteki Alacaklar) oranı
- Sermaye Yeterlilik Rasyosu (SYR)
- Maliyet/Gelir oranı
- TL/YP mevduat dağılımı
```

**Model seçimi:** Gemini 2.5 Flash veya Pro (özellikle dipnot okuyacaksa Pro). Synthesizer kalitesi için kritik bir worker — kalite > hız.

---

### Agent 5: Sentiment & News Worker

**Rol:** Son 30 günün haber akışı + sosyal medya sentiment'ını ölçer.

**Görev kapsamı:**
- Son 30 gün haberleri özet + sentiment skoru
- Önemli haber akışını (örn. büyük sözleşme, yönetim değişikliği) flag'le
- Twitter/X'te `$TICKER` etiketinin sentiment trendi
- Analist rapor revizyonları (TP, rating)

**Tools:**
```python
@tool
def fetch_news(ticker: str, days: int = 30) -> list[Article]:
    """Mynet Finans, Bloomberg HT, Bigpara'dan haber."""

@tool
def score_sentiment(text: str) -> float:
    """Türkçe sentiment skor (-1 to +1).
    Implementation: Gemini'ye soruyoruz, küçük model."""

@tool
def detect_material_events(articles: list[Article]) -> list[Event]:
    """Önemli olayları flag'le (M&A, yönetim değişikliği, ihale)."""

@tool
def social_sentiment_trend(ticker: str) -> SentimentTrend:
    """Son 30 gün sosyal medya trend."""

@tool
def get_analyst_revisions(ticker: str) -> list[Revision]:
    """Analist hedef fiyat değişiklikleri (manuel scrape)."""
```

**Sentiment skorlamada hata payı uyarısı:** Türkçe sentiment LLM'ler için daha az doğru. Çözüm: **multiple-shot prompt** + "emin değilsen 'nötr' de" instruction.

**Model seçimi:** Gemini 2.5 Flash-Lite — büyük hacim, ucuz olmalı.

---

### Agent 6: Devil's Advocate (En zekice ajan)

**Rol:** Diğer 3 worker'ın çıktısını alır, **her birine kontra argüman üretir**.

Bu ajan ThesisForge'un **ayrıştırıcı özelliği**. Klasik finans AI sistemleri tek perspektif sunar. ThesisForge **bilinçli olarak** tezini sorgular.

**Görev kapsamı:**
- Teknik ajanın bull case'ine bear-side karşı argüman
- Temel ajanın hipotezine alternatif yorum
- Sentiment ajanın momentum'una "ama dikkat" notları
- Cross-cutting riskler (worker'ların atladığı şeyler)
- Confirmation bias kontrol listesi

**Tools:**
```python
@tool
def query_workers(question: str, target_workers: list[str]) -> dict:
    """A2A: workerlara dönüp ek soru sor.
    'Sen RSI 71 dedin, peki son sefer RSI 71'de neye olmuştu?'"""

@tool
def find_disconfirming_evidence(claim: str, ticker: str) -> list[Evidence]:
    """Bir iddianın aksini destekleyen veri ara."""

@tool
def base_rate_check(pattern: str, lookback_years: int) -> BaseRate:
    """Bu pattern geçmişte ne sıklıkta yanılıyor?"""
```

**Prompt iskeleti (kritik!):**
```
Sen bir KIDEMLI RİSK YÖNETİCİSİ rolündesin. Bu rol senin için doğal değil:
sen kuşkucu, eleştirel, "ama dur"cu olmalısın.

3 worker'ın çıktıları aşağıda. Görevin:

1. HER WORKER ÇIKTISINDA en az 1 zayıf nokta bul
2. Her zayıflık için somut karşı kanıt ara (find_disconfirming_evidence kullan)
3. Worker'ların CROSS olarak atladığı bir riski tespit et 
   (örn: hepsi şirket-spesifik baktı, makro riski kimse görmedi)
4. Pattern claim varsa BASE RATE kontrolü yap
5. Çıktın: structured JSON (Critique schema)

ÖNEMLİ: Hisseyi köteleme için kötülemiyorsun. Tezi GÜÇLENDİRMEK için 
zayıflıkları açığa çıkarıyorsun. Eğer gerçekten karşı argüman zayıfsa, 
"karşı argümanlar zayıf, tez sağlam" demek de doğru cevap.

Tools: {tool_list}
```

**Worker output schema:**
```python
class Critique(BaseModel):
    technical_pushback: list[Counterargument]
    fundamental_pushback: list[Counterargument]
    sentiment_pushback: list[Counterargument]
    cross_cutting_risks: list[Risk]
    base_rate_warnings: list[BaseRateWarning]
    overall_critique_strength: Literal["strong", "moderate", "weak"]
```

`overall_critique_strength` çok önemli — Synthesizer bunu ağırlık olarak kullanacak.

**Model seçimi:** Gemini 2.5 Pro veya 3 Flash. Critique kalitesi → demo kalitesi. Ucuzluk için ödün verme.

---

### Agent 7: Memory Agent (Stateful)

**Rol:** Sistemin **kurumsal hafızası**. Geçmiş tezleri saklar, benzerlerini bulur, hangi pattern'ler tutmuş hangileri tutmamış öğretir.

Bu ajan demo'da en görsel ajanlardan biri olur:
> *"6 ay önce ASELS için savunma ihalesi gerekçesiyle bull tez yazmıştım. Hisse 6 ay sonra +%23. Bu sefer benzer pattern var ama ek olarak..."*

**Görev kapsamı:**
- Yeni tezi vector embed et, ChromaDB'ye yaz
- Yeni tez geldiğinde, semantik benzerlik ile geçmiş tezleri bul
- Geçmiş tezlerin "ground truth" performansını hesapla (90 gün sonraki fiyat değişimi)
- "Bu tür tez geçmişte X% başarılı" gibi base rate üret
- Pattern memory: aynı kullanıcı için tutarsızlıkları yakala

**Schema:**
```python
class StoredThesis(BaseModel):
    ticker: str
    thesis_date: datetime
    bull_points: list[str]
    bear_points: list[str]
    catalysts: list[str]
    confidence: float
    embedding: list[float]  # pgvector
    
    # Ground truth (yedi gün, 30 gün, 90 gün sonra)
    price_at_thesis: float
    price_7d: Optional[float]
    price_30d: Optional[float]
    price_90d: Optional[float]
    thesis_outcome: Literal["correct", "partial", "wrong", "pending"]
```

**Tools:**
```python
@tool
def find_similar_theses(thesis: dict, n: int = 5) -> list[StoredThesis]:
    """Vector similarity ile geçmiş tezler."""

@tool
def get_outcome_stats(similar_theses: list) -> OutcomeStats:
    """Bu pattern geçmişte ne kadar tutmuş?"""

@tool
def save_thesis(thesis: StoredThesis):
    """Yeni tezi kaydet, gece batch ground truth update."""
```

**Cron job:** Her gece geçmiş tezlerin ground truth'unu yfinance'den günceller, başarı oranlarını yeniden hesaplar.

**Model seçimi:** Embedding için `text-embedding-004` (Gemini), reasoning için Flash.

---

### Agent 8: Synthesizer (Final composer)

**Rol:** Tüm bilgileri tek **kullanıcıya gösterilebilir tez**'e dönüştürür.

**Girdi:**
- Macro context
- 3 Worker raporu (yapılandırılmış)
- Devil's Advocate critique
- Memory'den benzer tezler + base rate

**Çıktı format:**
```markdown
# {TICKER} Yatırım Tezi — {DATE}

## TL;DR
{2-3 cümle özet}

## Bull Case ({worker güveni: %X})
- {claim 1} [kaynak: temel-3.2]
- {claim 2} [kaynak: teknik-1.4]
- ...

## Bear Case ({devil's advocate güç skoru: orta})
- {counter 1} [kaynak: critique-2.1]
- ...

## Anahtar Katalizörler
- 📅 {tarih}: {olay} — beklenen etki
- ...

## Tarihsel Bağlam
{memory'den 1 paragraf}

## Risk Uyarıları
{material risks}

## Güven Skoru: {0-100}
Hesaplama: {explainable breakdown}

---
*Bu içerik bilgi amaçlıdır, yatırım tavsiyesi değildir...*
```

**Prompt iskeleti:**
```
Sen bir kıdemli yatırım komitesi başkanısın. Tüm analist raporlarını 
ve risk uyarılarını sentezleyip yatırımcı için TEZ yazıyorsun.

KESİN KURALLAR:
1. Her CLAIM'in sonunda kaynak etiketi: [kaynak: <ajan-id>.<claim-id>]
2. Bull/Bear case dengeli olsun. Tek taraflıysa onu söyle.
3. "Tahmin" yapma. "Şu varsayımlar tutarsa" formatı kullan.
4. Sayılar uydurma — sadece tools'dan gelenleri kullan.
5. Güven skoru hesaplaması ŞEFFAFTIR — formülü açıkla.
6. Disclaimer ZORUNLU.

Format: {markdown_template}
```

**Citation enforcement:**
Her claim'i geriye dönüp gerçekten tool çıktısında olduğunu **doğrula**. Bu ayrı bir validation step:
```python
def validate_citations(thesis_md: str, tool_logs: list) -> list[Violation]:
    """Hallucination guard. Her [kaynak: X.Y] için tool log'da X.Y var mı?"""
```

Yoksa thesis reject + regenerate.

**Model seçimi:** Gemini 2.5 Pro veya 3.1 Pro. Tezin **kalitesi tek başına** burada belirlenir.

---

### Agent 9: Backtest Validator (opsiyonel, demo bonus)

**Rol:** Geçmişe gidip *"Bu sistem 6 ay önce aynı veriyle ne demiş olurdu?"* sorusunu cevaplar.

Bu hackathon için **çok güçlü bir wow-factor**. Ama **dikkat**: Time leakage en büyük tuzak. Sistem geçmiş tarihte **o tarihten sonraki veriyi görmemeli**.

**Yapılış:**
1. Bir tarih seç (örn. 6 ay önce)
2. Tüm tools'u "tarih kilitli" mode'a al — `as_of_date=2025-11-01`
3. Tüm pipeline'ı bu tarih için çalıştır
4. Üretilen tezi **bugünkü** fiyatla karşılaştır

**Sertifikalı doğru olması için:**
- KAP bildirimleri: tarih filtreli
- Fiyat verisi: tarih kilitli
- Haber: tarih filtreli
- Memory: o tarihte var olan tezler

Bu **çok uğraştırır**. 10 günlük scope için **demo'da 3 hisse için pre-computed** backtest sonuçları yeterli, gerçek zamanlı backtest scope dışı.

---

## 2.4 Veri akışı ve kullanıcı deneyimi (end-to-end)

### Senaryo: Mehmet "ASELS analiz et" yazıyor

```
0.0s — Mehmet: "ASELS analiz et"

0.1s — Frontend WebSocket bağlantısı açılır
       Backend Orchestrator devreye girer
       UI: "Komite toplanıyor..." animasyonu

0.5s — Orchestrator → Sector Router
       Router: "Defense Squad" döner
       UI: "Defense Squad seçildi" rozeti

0.6s — Macro Context cache'den (15dk fresh) yüklenir
       UI: makro paneli sağda dolar (faiz, kur, BIST)

0.7s — Orchestrator 3 worker'ı PARALEL tetikler
       UI: 3 ayrı kolon, her biri "düşünüyor..."

0.7-8.0s — Worker'lar paralel çalışır
   Technical: tools'u çağırır, RSI/MACD/pattern hesaplar
   Fundamental: KAP'tan son bildirimleri çeker, oran hesaplar
   Sentiment: 30 günlük haber çeker, scoring yapar
   
   Her tool call frontend'e stream:
   UI: "Technical → calculate_indicators → MACD: ..."

8.0s — 3 worker biter, çıktıları Orchestrator'a düşer
       UI: 3 kolon "tamamlandı" rozeti, özetler görünür

8.5s — Devil's Advocate tetiklenir
       Worker output'unu okur
       A2A: Workerlara geri dönüp soru sorabilir
       UI: "Devil's Advocate sorguluyor..." 

8.5-13.0s — Critique süreci
   "Technical 'pattern bozuluyor' demiş, base rate ne?"
   tool: base_rate_check → "son 12 ayda %42 doğru"
   UI: critique cümleleri canlı stream

13.0s — Memory check (paralel 13.0-13.5)
       "ASELS için son 6 ayda kaç tez yazılmış?"
       UI: "Geçmiş tezler: 3 bulundu"

13.5s — Synthesizer tetiklenir
        Tüm input'lar ona gider
        Markdown stream başlar (token-by-token)
        UI: tez canlı yazılır kullanıcının ekranına

13.5-22.0s — Synthesizer yazıyor
       Bull case → Bear case → Catalysts → Memory Context
       Her cümle stream

22.0s — Citation validator çalışır
        Her [kaynak] etiketi log'la match ediliyor mu?
        Eğer hata varsa: re-generation step

22.5s — Tez DB'ye kaydedilir
        Memory ajanı async embed eder

23.0s — UI: tam tez görünür, indir/paylaş butonu

       Mehmet: "Bear case'i daha detaylı anlat"
       (Follow-up: Synthesizer + Devil's Advocate'in 
        cached outputu üzerinden cevap, hızlı)
```

**Gözlemler:**
- Total süre: **~23 saniye** ilk tam tez için
- Follow-up sorular: **2-5 saniye** (cache + targeted reasoning)
- Token tüketimi: **~17K input, 5.5K output** = $0.02 per tez (Flash-mix)

## 2.5 Citation-grounded mimari — halüsinasyon savunması

Finansal AI'da en büyük risk: AI "ASELS'in P/E'si 14" der, gerçekte 22'dir. Sistem böyle bir hata yapmamalı.

**Savunma katmanları:**

**Katman 1 — Tool Provenance**
Her tool call **logged**:
```python
@dataclass
class ToolCallLog:
    agent_id: str
    tool_name: str
    args: dict
    result: Any
    timestamp: datetime
    call_id: str  # her çağrıya unique ID
```

**Katman 2 — Structured Output Schemas**
Worker'lar tool çıktılarına bağlı **structured output** üretir. Free-form text yok:
```python
class Claim(BaseModel):
    text: str
    citation_call_id: str  # hangi tool çağrısından geldi?
    confidence: float
```

**Katman 3 — Synthesizer Citation Enforcement**
Synthesizer her `[kaynak: X.Y]` etiketinde X.Y ID'sini tool log'a karşı doğrular. Yoksa **regeneration**.

**Katman 4 — Numeric Sanity Check**
Synthesizer'ın çıktısındaki tüm sayılar (örn. "%14 ROE") regex ile yakalanır, tool log'larda **gerçekten geçiyor mu** diye kontrol edilir. Geçmiyorsa flag.

Bu 4 katman birden hayata geçince halüsinasyon **pratik olarak imkansız** hale gelir.

## 2.6 Kullanılacak teknoloji yığını (final)

```toml
[backend]
python = "^3.11"
fastapi = "*"
uvicorn = "*"

[ai]
strands-agents = "*"
strands-agents-tools = "*"
google-generativeai = "*"
chromadb = "*"

[data]
yfinance = "*"
ta-lib = "*"
beautifulsoup4 = "*"
httpx = "*"
pandas = "*"
pydantic = "*"

[persistence]
sqlalchemy = "*"
psycopg2-binary = "*"
redis = "*"
pgvector = "*"  # PostgreSQL'de embedding

[observability]
opentelemetry = "*"  # Strands native destekler
structlog = "*"

[frontend]
# Next.js 15, Tailwind, shadcn/ui, recharts
# WebSocket: native + socket.io fallback
```

## 2.7 Deploy mimarisi (hackathon için pragmatik)

**Geliştirme:** Docker Compose — `postgres`, `redis`, `chromadb`, `backend`, `frontend` 5 container.

**Demo deploy:**
- Backend → Railway veya Fly.io (Python desteği iyi, free tier var)
- Frontend → Vercel (Next.js native)
- PostgreSQL → Supabase (free tier, pgvector built-in)
- Redis → Upstash (free tier, serverless)
- ChromaDB → backend ile aynı container (embedded mode)

**Maliyet:** Hackathon süresince ~$0-5 (tüm free tier'lar yetiyor).

## 2.8 Riskler ve azaltma planı

| Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|
| KAP scraper kırılır | Yüksek | Orta | Önceden 90 gün veri cache'le, fallback static dataset |
| Gemini rate limit | Orta | Yüksek | 3 farklı API key, exponential backoff, Flash öncelikli |
| TA-Lib kurulum sorunu | Yüksek (Linux) | Orta | Docker image hazırla, pre-built `.whl` |
| Citation enforcement çok katı, sürekli regen | Orta | Yüksek | Validator'ı önce **soft warn** moduna al, sertleştirme son gün |
| Devil's Advocate prompt zayıf çıkar | Orta | Yüksek | 3-4 farklı prompt versiyonu test et, en iyisini seç |
| Demo'da BIST kapalı | Düşük | Orta | Pre-recorded session + canlı simülasyon backup |
| Strands A2A protocol yeni | Orta | Orta | Agent-as-Tool fallback'e hazır ol |

