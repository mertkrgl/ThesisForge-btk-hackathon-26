# ThesisForge — Detaylı Proje Analizi

> Bu dosya `prompt.md` üzerindeki ürün ve teknik tasarımın **detaylı, scan-edilebilir, eleştirel** versiyonudur.
>
> Üç ana bölümden oluşur:
>
> 1. **Bölüm 1 — Proje Mantığı ve Ürün Vizyonu:** Proje neden var, kime hitap ediyor, kullanıcı yolculuğu nasıl işliyor, hangi değeri üretiyor.
> 2. **Bölüm 2 — Teknik Tasarım:** Mimari katmanlar, ajan kataloğu (kod bloklarıyla tam detay), veri akışı, kullanılan teknolojiler, deploy stratejisi.
> 3. **Bölüm 3 — Eleştirel İnceleme:** Mevcut tasarımdaki tutarsızlıklar, açık uçlar, scope riskleri ve önerilen düzeltmeler (15 madde).

---

## İçindekiler

- [BÖLÜM 1 — Proje Mantığı ve Ürün Vizyonu](#bölüm-1--proje-mantığı-ve-ürün-vizyonu)
  - [1.1 Tek Cümleyle Ne Yapar](#11-tek-cümleyle-ne-yapar)
  - [1.2 Çözülen Problem](#12-çözülen-problem)
  - [1.3 Ne Olduğu / Ne Olmadığı](#13-ne-olduğu--ne-olmadığı)
  - [1.4 Hedef Kullanıcılar (Persona'lar)](#14-hedef-kullanıcılar-personalar)
  - [1.5 Örnek Akış Şeması — Kullanıcı Yolculuğu](#15-örnek-akış-şeması--kullanıcı-yolculuğu)
  - [1.6 Değer Önerisi ve Limitler](#16-değer-önerisi-ve-limitler)
  - [1.7 Rakip Konumlama](#17-rakip-konumlama)
  - [1.8 Ürünleştirme Modeli](#18-ürünleştirme-modeli)
- [BÖLÜM 2 — Teknik Tasarım](#bölüm-2--teknik-tasarım)
  - [2.1 Üst Seviye Sistem Mimarisi](#21-üst-seviye-sistem-mimarisi)
  - [2.2 Mimari Kararların Gerekçeleri](#22-mimari-kararların-gerekçeleri)
  - [2.3 Multi-Agent Pattern Seçimi (Strands)](#23-multi-agent-pattern-seçimi-strands)
  - [2.4 Ajan Kataloğu — Detaylı](#24-ajan-kataloğu--detaylı)
  - [2.5 Citation-Grounded Mimari](#25-citation-grounded-mimari--halüsinasyon-savunması)
  - [2.6 Uçtan Uca Veri Akışı](#26-uçtan-uca-veri-akışı)
  - [2.7 Persistence Şemaları](#27-persistence-şemaları)
  - [2.8 Teknoloji Yığını](#28-teknoloji-yığını)
  - [2.9 Deploy Mimarisi](#29-deploy-mimarisi)
  - [2.10 Risk ve Azaltma Tablosu](#210-risk-ve-azaltma-tablosu)
- [BÖLÜM 3 — Eleştirel İnceleme: Düzeltilmesi Gereken Kısımlar](#bölüm-3--eleştirel-i̇nceleme-düzeltilmesi-gereken-kısımlar)

---

# BÖLÜM 1 — Proje Mantığı ve Ürün Vizyonu

## 1.1 Tek Cümleyle Ne Yapar

> **ThesisForge:** *"Profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan AI sistemi."*

Yani ThesisForge bir "borsa botu" ya da "AI fal bakıcısı" değil; **karar destek sistemi**dir. Kullanıcının **kararı yerine geçmez**, kararı **daha iyi vermesini** sağlar. Sistemin diferansiyatörü çıktının kendisinden çok **çıktıyı üreten süreçtir**: Birden fazla "analist ajan" aynı hisseye farklı açılardan bakar, biri devil's advocate olarak tezi sorgular, sentezleyici son kararı bull/bear/catalyst yapısında derler.

Bu cümle kritik çünkü:

- **Regülasyon riskini azaltır.** SPK'nın "yatırım danışmanlığı" tanımına girmemek için sistem **tez üretici** olarak konumlanır, **öneri yapıcı** olarak değil.
- **Judge psikolojisi** açısından akıllıdır. Hackathon judge'ları AI'dan korkuyorsa "AI insan yerine karar verir" diye korkuyor. Konumlandırma ile bu korkuyu en başta söndürürüz.

## 1.2 Çözülen Problem

### Türkiye'nin Retail Yatırımcı Tablosu

- Türkiye'de **6 milyondan fazla** bireysel yatırım hesabı var.
- Çoğu **son 4-5 yılda** açıldı (enflasyondan kaçış + döviz kontrolleri).
- Sonuç: **piyasaya yeni gelmiş, deneyimsiz, ama parası olan** çok büyük bir kitle.

Bu kitle bir hisseyi araştırırken aşağıdakilerden birini yapar — ve hepsinin ciddi açıkları vardır:

| Yöntem | Sorun |
|---|---|
| **Sosyal medya / Telegram grupları** | Pump-dump çetelerinin yemi olur, manipülasyona açık |
| **YouTube "borsa hocaları"** | Çoğu sponsorlu, çıkar çatışması, gecikmiş bilgi |
| **Tek bir aracı kurum raporu** | Tek perspektif, kurumun pozisyonuna göre eğimli |
| **Kendi araştırması** | KAP'ı okumayı bilmiyor, finansal tabloyu anlayamıyor, haber + sentiment + teknik üçünü birleştiremiyor |
| **Robo-advisor'lar** | Türkiye'de hemen hemen yok; varsa portföy önerir, **tez üretmez** |

### Asıl Sorun

Bir hisse hakkında **çok-perspektifli, dengeli, kaynaklı** bir görüş üretmek için profesyonel yatırım komitelerinin yaptığı iş gerekir: birden çok analist farklı açılardan bakar, bir risk yöneticisi karşı çıkar, bir başkan sentez yapar. Bu **süreç** retail yatırımcıya hiçbir ürün tarafından sunulmuyor.

ThesisForge'un savunulabilir farkı tam burada: çıktıyı değil, **çıktıyı üreten komite sürecini** modeller.

## 1.3 Ne Olduğu / Ne Olmadığı

Bu kontrast tablosu sunumun **ilk 60 saniyesinde** judge'ın kafasındaki "robo-trader" kalıbını söker:

| ThesisForge **DEĞİLDİR** | ThesisForge **AYNEN BUDUR** |
|---|---|
| Bot — kullanıcı yerine işlem yapmaz | **Karar destek sistemi** — kararı kullanıcı verir |
| Tahmin makinesi ("ASELS yarın 75 TL olur") | **Tez üretici** ("Şu varsayımlar doğru çıkarsa yön yukarı") |
| Garanti vaad eden sistem | Belirsizliği **explicit hesaplayan**, güven aralığı veren |
| Tek doğru cevap üretir | **Bull case + Bear case + Anahtar katalizörler** üretir |
| Black box | **Her cümlenin kaynağı görünür** (cite-able) |
| HFT / intraday tahmin aracı | **Swing-trade ve uzun vadeli yatırım** aracı |
| Yatırım danışmanlığı (SPK lisansı gerektirir) | **Bilgi sunumu ve eğitim aracı** (lisans dışı) |

## 1.4 Hedef Kullanıcılar (Persona'lar)

### Persona 1 — Mehmet (34, Mühendis) — *"Hobby Investor"*

- BIST'te 6 yıldır var, 7 hisselik portföy.
- Maaşının %20'sini yatırıma ayırıyor.
- İş yoğun, hisse araştırmaya **haftada 1–2 saat** ayırabiliyor.
- Mevcut davranış: Bloomberg HT izliyor, sosyal medyaya bakıyor, kafası karışık.
- **Problem:** Bilgi fazla, sentez zor. *"Hangisi gerçekten önemli?"*
- **ThesisForge'da değer:** Watchlist'inin tezini haftalık 10 dakikada güncelleyip karar moduna geçer.

### Persona 2 — Zeynep (27, Finans Öğrencisi / Junior Analyst) — *"Aspiring Pro"*

- CFA Level 1 hazırlanıyor.
- Kendi araştırmasını yapıyor ama **her açıyı tek başına kapsayamıyor**.
- KAP'ı okumayı **biliyor**, ama 5 yıllık bilanço analizini manuel yapmak çok zaman alıyor.
- **Problem:** Verim. Profesyonel iş akışını taklit etmek istiyor ama tek başına.
- **ThesisForge'da değer:** Kendi tezini yazmadan önce "AI komite ne demiş" diye bakar, **kör noktalarını yakalar**.

### Persona 3 — Ali Bey (56, Emekli Devlet Memuru) — *"Conservative Saver"*

- Emeklilik birikimini değerlendirmek istiyor.
- Temettü hisselerine ilgili (BIMAS, AKBNK, EREGL gibi).
- Teknik analizi **anlamıyor ve istemiyor** — temel hikaye yeterli.
- **Problem:** Yanlış hisseye girip sermayeyi yakma korkusu.
- **ThesisForge'da değer:** "Conservative mode" — bear case'i daha ağırlıklı görür, temettü güvenliği vurgulanır. *(Not: Conservative mode mevcut tasarımda netleşmemiş — bkz. Bölüm 3, madde #3.)*

### Sekonder Persona — Junior PM / Analyst (Kurumsal)

Hackathon hedef kitlesi değil, ama **B2B genişlemesi** için kritik:

- Aracı kurumlarda junior analistler ThesisForge'u **brifing aracı** olarak kullanabilir.
- Sabah toplantısı için 5 hisselik özet hazırlayan asistan.
- Judge sorduğunda *"B2B opsiyonu da var"* diyebilmek değerli.

## 1.5 Örnek Akış Şeması — Kullanıcı Yolculuğu

### 1.5.1 Yüksek Seviye Akış (Flowchart)

```
        ┌─────────────────────┐
        │  Kullanıcı sorgusu  │
        │  "ASELS analiz et"  │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │   Orchestrator      │
        │  (intent + ticker)  │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐         ┌──────────────────┐
        │   Sector Router     │ ◀────── │  Macro Context   │
        │  squad seçimi       │         │  (cached, 15dk)  │
        └──────────┬──────────┘         └──────────────────┘
                   ▼
   ┌───────────────┼───────────────┐
   ▼               ▼               ▼
┌───────┐      ┌───────┐      ┌─────────┐
│ Tech. │      │Fund.  │      │Sentiment│   ← 3 worker PARALEL
└───┬───┘      └───┬───┘      └────┬────┘
    └──────────┬───┴──────────┬────┘
               ▼              ▼
        ┌─────────────────────┐
        │  Devil's Advocate   │  ← worker output'unu sorgular
        │  (kontra argüman)   │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐         ┌──────────────────┐
        │   Memory Agent      │ ◀────── │ ChromaDB / pgvec │
        │  (geçmiş + base     │         │ benzer tezler    │
        │   rate)             │         └──────────────────┘
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │    Synthesizer      │
        │  (final tez yazımı) │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │ Citation Validator  │  ← halüsinasyon kontrol
        │ (her sayı tool log'a│
        │  bağlı mı?)         │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │  Tez UI'ye stream   │
        │  + DB'ye kaydet     │
        │  + Memory'e embed   │
        └─────────────────────┘
```

### 1.5.2 Zaman Damgalı Senaryo — *"Mehmet ASELS analiz et yazıyor"*

```
0.0s  │ Kullanıcı: "ASELS analiz et"
0.1s  │ WebSocket bağlantısı açılır
      │ Orchestrator devreye girer
      │ UI: "Komite toplanıyor..." animasyonu
      │
0.5s  │ Orchestrator → Sector Router
      │ Router: "Defense Squad" döner
      │ UI: "Defense Squad seçildi" rozeti
      │
0.6s  │ Macro Context cache'den (15dk fresh) yüklenir
      │ UI: makro paneli sağda dolar (faiz, kur, BIST)
      │
0.7s  │ Orchestrator 3 worker'ı PARALEL tetikler
      │ UI: 3 ayrı kolon, her biri "düşünüyor..."
      │
0.7s  │ ┌──────────────────────────────────────────┐
 ↓    │ │ Technical: get_ohlcv → indicators → ...  │
8.0s  │ │ Fundamental: KAP filings → ratios → peer │
      │ │ Sentiment: news fetch → score → events   │
      │ └──────────────────────────────────────────┘
      │ Her tool call frontend'e canlı stream
      │
8.0s  │ 3 worker biter, çıktıları Orchestrator'a düşer
      │ UI: 3 kolon "tamamlandı" rozeti
      │
8.5s  │ Devil's Advocate tetiklenir
      │ Worker output'unu okur, A2A ile soru sorar
      │ UI: "Devil's Advocate sorguluyor..."
      │
8.5s  │ Critique süreci:
 ↓    │   "Technical 'pattern bozuluyor' demiş, base rate ne?"
13.0s │   tool: base_rate_check → "son 12 ayda %42 doğru"
      │ UI: critique cümleleri canlı stream
      │
13.0s │ Memory check (paralel)
      │ "ASELS için son 6 ayda kaç tez yazılmış?"
      │ UI: "Geçmiş tezler: 3 bulundu"
      │
13.5s │ Synthesizer tetiklenir
      │ Markdown stream başlar (token-by-token)
      │ UI: tez canlı yazılır kullanıcının ekranına
      │
13.5s │ Bull case → Bear case → Catalysts → Memory Context
 ↓    │ Her cümle stream
22.0s │
      │
22.0s │ Citation validator çalışır
      │ Her [kaynak] etiketi log'la match ediyor mu?
      │ Hata varsa → re-generation
      │
22.5s │ Tez DB'ye kaydedilir
      │ Memory ajanı async embed eder
      │
23.0s │ UI: tam tez görünür, indir/paylaş butonu
      │
   ─  │ Mehmet: "Bear case'i daha detaylı anlat"
   ─  │ Follow-up: cached output üzerinden 2-5s'de cevap
```

### 1.5.3 Süre ve Maliyet Tahmini

| Metrik | Değer | Not |
|---|---|---|
| İlk tam tez süresi | ~23 saniye (iddialı) | Pratikte 40-60s daha gerçekçi (bkz. Bölüm 3, madde #6) |
| Follow-up sorgu süresi | 2-5 saniye | Cache + targeted reasoning |
| Token tüketimi (per tez) | ~17K input, 5.5K output | Flash-mix model dağıtımı ile |
| Yaklaşık maliyet (per tez) | $0.02 | Gemini 2.5 Flash + 2.5 Pro karışımı |

## 1.6 Değer Önerisi ve Limitler

### Gerçekten Değer Üreten Kısımlar

**1. Bilgi sentezi** *(Yüksek güvenilirlik)*
İnsan analistin yaptığı bilgi toplama–özetleme işini AI **ucuz, hızlı, paralel** yapar. Perplexity, Deep Research gibi sistemler zaten kanıtladı. ThesisForge'un bu kısmı %100 gerçek değer üretir.

**2. Kör nokta yakalama (Devil's Advocate)** *(Orta–yüksek güvenilirlik)*
Yatırım kararındaki en büyük insan hatası **confirmation bias**. AI'a "bu tezin tersini savun" demek bireyin kendi kafasında yapamadığı bir egzersizi yaptırır. Akademik literatürde [premortem analysis](https://hbr.org/2007/09/performing-a-project-premortem) ve [red-teaming](https://en.wikipedia.org/wiki/Red_team) tekniklerinin karar kalitesini iyileştirdiği gösterilmiştir.

**3. Yapılandırılmış sunum** *(Yüksek güvenilirlik)*
Bull / Bear / Catalysts framework'ü Bridgewater, Goldman, Morgan Stanley gibi kurumların **standart formatı**. AI bu yapıyı dayatır → kullanıcı dağınık bilgi yerine net seçenekler görür.

**4. Geçmişle karşılaştırma (Memory)** *(Orta güvenilirlik)*
*"Bu tür pattern son 12 ayda kaç kere doğru çıktı?"* sorusu **base rate awareness** sağlar. Bu psikolojik anchor kullanıcıyı aşırı güvenden korur.

### Limitler — Net Olarak Söylenmesi Gerekenler

**1. Tahmin değil tez.** Sistem *"hisse yükselir"* demez, *"şu varsayımlar tutarsa yukarı yön baskın"* der. Kullanıcı varsayımları kendi değerlendirir.

**2. Veri tazelği.** KAP, news, sentiment verileri gecikmeli. ThesisForge **HFT/intraday için değil**, swing-trade ve uzun vadeli yatırım için.

**3. Lisans / regülasyon.** Türkiye'de **yatırım danışmanlığı SPK lisansı** ister. Bu yüzden ThesisForge "**bilgi sunumu ve eğitim aracı**" konumlandırmasıyla yaşar, "öneri" ile değil. Her cümle disclaimer'lı olmalı.

**4. Halüsinasyon riski.** Finansal sayılarda bir rakam yanlış olursa felaket. **Citation-grounded mimari** zorunlu (bkz. §2.5).

**5. Backtest tuzakları.** Tarihsel performans gelecek garantisi değil. Sistem bu uyarıyı kullanıcıya **görünür** tutmalı.

## 1.7 Rakip Konumlama

| Rakip | Ne yapıyor | ThesisForge'un farkı |
|---|---|---|
| **Mynet Finans, Bigpara** | Haber + grafik aggregator | Sentez yok, kullanıcı kendi yapar |
| **Foreks, Matriks** | Profesyonel terminal | Pahalı (binlerce TL), retail değil |
| **Aracı kurum raporları** | Profesyonel analiz | Geç gelir, tek perspektif |
| **Türk fintech botları** (varsa) | Genel tavsiye, basit | Multi-agent ve **memory yok** |
| **ChatGPT / Claude direkt** | Genel amaçlı | Türk piyasasına özel değil, tool yok, hafıza yok |

**ThesisForge'un savunulabilir farkı:**

> *Türk piyasası odaklı + multi-agent komite süreci + memory + her sayının kaynağı görünür.*

Bu kombinasyon piyasada **yok**.

## 1.8 Ürünleştirme Modeli

ThesisForge'u "ürünleştirilebilir mi?" sorusunun cevabı **evet, ama belirli bir modelle**:

| Model | Açıklama | Tahmini Birim Ekonomisi |
|---|---|---|
| **B2C SaaS (Türkiye)** | Aylık 99–149 TL premium subscription | KAP/yfinance ücretsiz veri kaynakları sayesinde unit economics çalışır |
| **B2B (aracı kurumlar)** | Junior analyst tool olarak satış, white-label | Kurum başı yıllık 50–200K TL |
| **Hibrit (Freemium)** | Free tier (3 sorgu/gün) + Pro tier | Fintech klasik freemium modeli |

Bu detaylar sunumun "ürünleştirme" slaytı için hazır içerik. Hackathon judge'ları ürün vizyonuna pozitif yanıt verir.

---

# BÖLÜM 2 — Teknik Tasarım

## 2.1 Üst Seviye Sistem Mimarisi

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
│  ChromaDB / pgvector (embedded thesis memory, RAG context)    │
│  Redis (cache + agent state + queue)                          │
│  S3 / MinIO (reports, PDF exports)                            │
└───────────────────────────────────────────────────────────────┘
```

> **Not:** Embedding store seçimi için Bölüm 3, madde #1'e bak — `pgvector` tek seçenek olarak tavsiye edilir.

### Katmanlar Özeti

| Katman | Sorumluluk | Teknolojiler |
|---|---|---|
| **Presentation** | Kullanıcı arayüzü, real-time stream | Next.js 15, Tailwind, shadcn/ui, recharts, native WebSocket |
| **Application** | API, orchestration, intent routing | FastAPI, uvicorn, Pydantic |
| **Agent** | Multi-agent reasoning, tool dispatch | Strands Agents, Strands Tools |
| **Data & Tool** | Veri kaynaklarına erişim, hesaplama | yfinance, TA-Lib (veya pandas-ta), KAP scraper, BeautifulSoup, httpx |
| **Persistence** | Yapılı veri, embedding, cache, dosya | PostgreSQL + pgvector, Redis, S3/MinIO |

## 2.2 Mimari Kararların Gerekçeleri

### Neden FastAPI?

- **Async-native:** Uzun süren tool çağrılarını paralelleştirmek için kritik.
- **WebSocket native:** Agent thinking stream ve canlı tez yazımı için doğal seçim.
- **Strands ile birinci sınıf entegrasyon:** Python ekosistemi, async/await ile uyumlu.
- **OpenAPI dokümantasyonu otomatik:** Frontend tarafındaki tip üretimi kolay.
- **Alternatifler değerlendirildi:** Flask (async desteği zayıf), Django (overkill), Node.js + Express (Strands Python ekosisteminden uzaklaştırır).

### Neden PostgreSQL + Embedding Store Ayrı?

- Yapılandırılmış veriler (kullanıcı, watchlist, tez kaydı, ground truth) → **PostgreSQL** (ilişkisel sorgu, JOIN, transaction).
- Embedding / semantic search (geçmiş tezlerle anlamsal benzerlik) → **pgvector** (PostgreSQL extension; ayrı servis dert etmeden vector search).
- **Hibrit RAG:** Aynı PostgreSQL içinde hem ilişkisel hem vector sorgu, tek backup, tek connection pool.
- Eğer pgvector hız problemi yaratırsa → ChromaDB (embedded mode) fallback.

### Neden Redis?

Üç ayrı görev için:

1. **Strands agent state cache** — Konuşma bağlamı ve intermediate tool sonuçları.
2. **Rate-limit cache** — yfinance/KAP cevaplarını 15dk TTL ile cache'le; aynı hisseye art arda gelen istekleri ucuza karşıla.
3. **WebSocket pub/sub** — Çoklu backend instance arasında agent event'lerini yayınla.

### Neden Next.js?

- **PWA desteği out-of-the-box** — Mobile-first kolay, "uygulamanı her yerden aç" hikayesi.
- **Server-side rendering opsiyonel** — SEO ve hızlı first paint.
- **Geliştirici tecrübesi:** Önceki frontend deneyimi bu ekosisteme yatkın.
- **API routes** — Frontend-backend arasında lightweight proxy gerekirse hızlıca yapılır.

## 2.3 Multi-Agent Pattern Seçimi (Strands)

[Strands](https://strandsagents.com/)'in 4 multi-agent pattern'i var: **Agent-as-Tool, Swarm, Graph, Workflow**. ThesisForge bu pattern'leri **hibrit** kullanır:

| Bölüm | Pattern | Neden |
|---|---|---|
| Sector Router → Worker selection | **Graph** | Conditional branching var (sektöre göre farklı squad) |
| Worker'lar paralel (Teknik+Temel+Sentiment) | **Agent-as-Tool** (parallel) | Bağımsız çalışırlar, sonuç orchestrator'a döner |
| Devil's Advocate ↔ Workers | **A2A protocol** | Devil's Advocate worker'lara kontra soru sorabilmeli |
| Synthesizer | **Tek ajan + structured output** | Ne kadar deterministik çıktı o kadar iyi |
| Memory check | **Tool call** | Stateless, bir DB sorgusundan ibaret |

> **Not:** Strands'in A2A protokolü henüz olgunluk açısından risk taşıyor. Plan B: Devil's Advocate'i **Agent-as-Tool** ile geri-besleme döngüsüne çevir (bkz. Bölüm 3, madde #7).

## 2.4 Ajan Kataloğu — Detaylı

Sistem 9 ana ajan + 1 opsiyonel ajan içerir. Her birinin **rol, sorumluluk, tools, prompt iskeleti, çıktı şeması ve model seçimi** aşağıda detaylandırılmıştır.

---

### Agent 0 — Macro Context Agent (Sürekli Çalışan Worker)

**Rol:** Her tez talebinden bağımsız olarak **sürekli güncel** Türk makro durumunu özetler. Tüm diğer ajanlara context olarak verilir.

**Tools:**

```python
get_tcmb_indicators()        # faiz, enflasyon, kur (TCMB EVDS API)
get_bist_index_state()       # BIST 30/100 trend, hacim
get_global_signals()         # S&P 500, VIX, USD endeksi, petrol
get_recent_macro_news()      # son 7 gün makro haberlerinin özeti
```

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

**Model seçimi:** Gemini 2.5 Flash (hızlı, ucuz, makro özet için yeterli).

---

### Agent 1 — Orchestrator

**Rol:** Kullanıcı sorgusunu alır, **ne yapılacağını planlar**, alt-ajanları tetikler, çıktıları toplar.

**Sorumluluklar:**

1. Kullanıcı niyetini anla (analiz mi, soru cevap mı, watchlist güncellemesi mi?).
2. Hisse ticker'ını valide et.
3. Hangi sektör squad'ının çalışacağına karar ver (Sector Router'a delege).
4. Worker'lara paralel görev dağıt.
5. Devil's Advocate'i tetikle.
6. Synthesizer'a gönder.
7. Memory'e kaydet.

**Tools:**

```python
validate_ticker(symbol)                    # BIST'te var mı?
dispatch_workers(squad_name, ticker, depth) # paralel worker invocation
get_macro_context()                         # Macro Agent'tan güncel context
save_thesis(thesis_obj)                     # DB'ye kaydet
```

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

        # Devil's Advocate (sequential, worker output'unu ister)
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

### Agent 2 — Sector Router

**Rol:** Hisseyi sektöre göre sınıflandırır ve doğru "squad"'ı seçer.

**10 günlük scope için 3 squad:**

1. **Banking Squad** — GARAN, AKBNK, ISCTR, YKBNK, HALKB, VAKBN
2. **Defense / Industrial Squad** — ASELS, OTKAR, TUPRS, EREGL, KCHOL
3. **Retail / Consumer Squad** — BIMAS, MGROS, SOKM, ULKER, CCOLA

Hisseler bu squad'lardan birine düşmüyorsa **Generic Squad** fallback. *(Not: TUPRS gibi enerji devi Defense altında listelenmiş — bkz. Bölüm 3, madde #11.)*

**Squad'lar arasındaki fark:** Worker'ların `system_prompt`'ı farklı; aynı kod farklı prompt:

- Banking ajanı NIM, NPL, capital adequacy düşünür.
- Defense ajanı backlog, ihale süreci, geo-political risk düşünür.
- Retail ajanı SSS (same store sales), enflasyon pass-through düşünür.

**Tools:**

```python
lookup_sector(ticker)   # BIST sektör mapping (statik tablo)
select_squad(sector)    # squad nesnesi döner
```

**Model seçimi:** Gemini 2.5 Flash-Lite — bir sınıflandırma görevi, ucuz.

---

### Agent 3 — Technical Analyst Worker

**Rol:** Hissenin son 90 günlük fiyat/hacim verisini analiz eder.

**Görev kapsamı:**

- Trend yönü (kısa, orta, uzun vade).
- Anahtar destek / direnç seviyeleri.
- RSI, MACD, hacim divergence.
- Pattern detection (kafa-omuz, üçgen, bayrak, vs.).
- Volatilite (ATR, Bollinger Band genişliği).
- Sektör endeksine göre relative strength.

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
    key_levels: list[Level]                # support/resistance
    momentum_score: float                  # -1 to +1
    patterns_detected: list[str]
    notable_observations: list[Observation]
    citations: dict[str, ToolCall]         # her observation hangi tool çıktısından
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

### Agent 4 — Fundamental Analyst Worker

**Rol:** Şirketin finansal sağlığı, değerleme, sektör pozisyonunu analiz eder.

**Görev kapsamı:**

- Son 4 çeyrek finansal tablolar.
- Temel oranlar (P/E, P/B, ROE, ROA, D/E, EBITDA margin).
- Büyüme trendi (gelir, kâr, FAVÖK).
- Peer comparison (sektör arkadaşlarıyla).
- Önemli KAP bildirimleri (özel durum, yönetim değişiklikleri).
- Temettü geçmişi.

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

**Squad'a göre özelleşme — Banking örneği:**

```
Sen bir BANKACILIK SEKTÖRÜ uzmanısın. Standart oranların yanında
şunlara mutlaka bak:
- Net Faiz Marjı (NIM)
- TGA (Takipteki Alacaklar) oranı
- Sermaye Yeterlilik Rasyosu (SYR)
- Maliyet/Gelir oranı
- TL/YP mevduat dağılımı
```

**Model seçimi:** Gemini 2.5 Flash veya 2.5 Pro (özellikle dipnot okuyacaksa Pro). Synthesizer kalitesi için kritik bir worker — kalite > hız.

---

### Agent 5 — Sentiment & News Worker

**Rol:** Son 30 günün haber akışı + sosyal medya sentiment'ını ölçer.

**Görev kapsamı:**

- Son 30 gün haberleri özet + sentiment skoru.
- Önemli haber akışını (büyük sözleşme, yönetim değişikliği) flag'le.
- Twitter/X'te `$TICKER` etiketinin sentiment trendi. *(API maliyeti için bkz. Bölüm 3, madde #4.)*
- Analist rapor revizyonları (TP, rating).

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

**Sentiment skorlamada hata payı uyarısı:** Türkçe sentiment LLM'ler için daha az doğrudur. Çözüm: **multiple-shot prompt** + "emin değilsen 'nötr' de" instruction.

**Model seçimi:** Gemini 2.5 Flash-Lite — büyük hacim, ucuz olmalı.

---

### Agent 6 — Devil's Advocate (En Kritik Ajan)

**Rol:** Diğer 3 worker'ın çıktısını alır, **her birine kontra argüman üretir**.

Bu ajan ThesisForge'un **ayrıştırıcı özelliği**dir. Klasik finans AI sistemleri tek perspektif sunar; ThesisForge **bilinçli olarak** tezini sorgular.

**Görev kapsamı:**

- Teknik ajanın bull case'ine bear-side karşı argüman.
- Temel ajanın hipotezine alternatif yorum.
- Sentiment ajanın momentum'una "ama dikkat" notları.
- Cross-cutting riskler (worker'ların atladığı şeyler).
- Confirmation bias kontrol listesi.

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

**Çıktı şeması:**

```python
class Critique(BaseModel):
    technical_pushback: list[Counterargument]
    fundamental_pushback: list[Counterargument]
    sentiment_pushback: list[Counterargument]
    cross_cutting_risks: list[Risk]
    base_rate_warnings: list[BaseRateWarning]
    overall_critique_strength: Literal["strong", "moderate", "weak"]
```

`overall_critique_strength` kritik — Synthesizer bunu **ağırlık** olarak kullanır.

**Model seçimi:** Gemini 2.5 Pro. Critique kalitesi → demo kalitesi. Ucuzluk için ödün verme.

---

### Agent 7 — Memory Agent (Stateful)

**Rol:** Sistemin **kurumsal hafızası**. Geçmiş tezleri saklar, benzerlerini bulur, hangi pattern tutmuş hangileri tutmamış öğretir.

Demo'da en görsel ajanlardan biri:

> *"6 ay önce ASELS için savunma ihalesi gerekçesiyle bull tez yazmıştım. Hisse 6 ay sonra +%23. Bu sefer benzer pattern var ama ek olarak..."*

**Görev kapsamı:**

- Yeni tezi vector embed et, embedding store'a yaz.
- Yeni tez geldiğinde, semantik benzerlik ile geçmiş tezleri bul.
- Geçmiş tezlerin "ground truth" performansını hesapla (90 gün sonraki fiyat değişimi).
- "Bu tür tez geçmişte X% başarılı" gibi base rate üret.
- Pattern memory: aynı kullanıcı için tutarsızlıkları yakala.

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

### Agent 8 — Synthesizer (Final Composer)

**Rol:** Tüm bilgileri tek **kullanıcıya gösterilebilir tez**'e dönüştürür.

**Girdi:**

- Macro context.
- 3 Worker raporu (yapılandırılmış).
- Devil's Advocate critique.
- Memory'den benzer tezler + base rate.

**Çıktı format (Markdown şablon):**

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

```python
def validate_citations(thesis_md: str, tool_logs: list) -> list[Violation]:
    """Hallucination guard. Her [kaynak: X.Y] için tool log'da X.Y var mı?"""
```

Yoksa thesis reject + regenerate. *(Sonsuz döngü riski için bkz. Bölüm 3, madde #9.)*

**Model seçimi:** Gemini 2.5 Pro. Tezin **kalitesi tek başına** burada belirlenir.

---

### Agent 9 — Backtest Validator (Opsiyonel — Demo Bonus)

**Rol:** Geçmişe gidip *"Bu sistem 6 ay önce aynı veriyle ne demiş olurdu?"* sorusunu cevaplar.

Hackathon için **çok güçlü bir wow-factor**. Ama **dikkat**: time leakage en büyük tuzaktır. Sistem geçmiş tarihte **o tarihten sonraki veriyi görmemelidir**.

**Yapılış:**

1. Bir tarih seç (örn. 6 ay önce).
2. Tüm tools'u "tarih kilitli" mode'a al — `as_of_date=2025-11-01`.
3. Tüm pipeline'ı bu tarih için çalıştır.
4. Üretilen tezi **bugünkü** fiyatla karşılaştır.

**Sertifikalı doğru olması için:**

- KAP bildirimleri: tarih filtreli.
- Fiyat verisi: tarih kilitli.
- Haber: tarih filtreli.
- Memory: o tarihte var olan tezler.

Bu **çok uğraştırır**. 10 günlük scope için **demo'da 3 hisse için pre-computed** backtest sonuçları yeterli; gerçek zamanlı backtest scope dışı.

> **Çakışma uyarısı:** Memory Agent'ın gece cron job'u zaten geçmiş tezlerin ground truth'unu update ediyor. Bu iki bileşen overlap ediyor — hangisi nereye düşüyor netleşmeli (bkz. Bölüm 3, madde #8).

---

### Ajanlar — Hızlı Karşılaştırma Tablosu

| # | Ajan | Tip | Model | Anahtar Çıktı |
|---|---|---|---|---|
| 0 | Macro Context | Background worker (cached) | Gemini 2.5 Flash | Makro paragraf |
| 1 | Orchestrator | Coordinator | Gemini 2.5 Flash | Routing kararları |
| 2 | Sector Router | Classifier | Gemini 2.5 Flash-Lite | Squad seçimi |
| 3 | Technical Worker | Worker | Gemini 2.5 Flash | TechnicalAnalysis |
| 4 | Fundamental Worker | Worker | Gemini 2.5 Flash/Pro | FundamentalAnalysis |
| 5 | Sentiment Worker | Worker | Gemini 2.5 Flash-Lite | SentimentReport |
| 6 | Devil's Advocate | Critic | Gemini 2.5 Pro | Critique |
| 7 | Memory Agent | Stateful + Tool | text-embedding-004 + Flash | StoredThesis lookup |
| 8 | Synthesizer | Composer | Gemini 2.5 Pro | Final Markdown tez |
| 9 | Backtest Validator | (Opsiyonel) | — | Backtest raporu |

## 2.5 Citation-Grounded Mimari — Halüsinasyon Savunması

Finansal AI'da en büyük risk: AI "ASELS'in P/E'si 14" der, gerçekte 22'dir. Sistem böyle bir hata yapmamalı.

### 4 Katmanlı Savunma

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
Synthesizer'ın çıktısındaki tüm sayılar (örn. "%14 ROE") regex ile yakalanır, tool log'larda **gerçekten geçiyor mu** kontrol edilir. Geçmiyorsa flag.

Bu 4 katman birden hayata geçince halüsinasyon riski **ciddi şekilde azalır** — ancak finansal AI'da hatayı sıfırlamak teorik olarak imkansızdır; insan denetimi ve şeffaf kaynak gösterimi her zaman korunmalı.

> **Uyarı:** Citation enforcement'ın "regenerate" davranışı naive uygulanırsa sonsuz döngüye girebilir. Önerilen: Max 2 retry, sonra "warning" ile geç (bkz. Bölüm 3, madde #9).

## 2.6 Uçtan Uca Veri Akışı

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
   Technical:    tools'u çağırır, RSI/MACD/pattern hesaplar
   Fundamental:  KAP'tan son bildirimleri çeker, oran hesaplar
   Sentiment:    30 günlük haber çeker, scoring yapar

   Her tool call frontend'e stream:
   UI: "Technical → calculate_indicators → MACD: ..."

8.0s — 3 worker biter, çıktıları Orchestrator'a düşer
       UI: 3 kolon "tamamlandı" rozeti, özetler görünür

8.5s — Devil's Advocate tetiklenir
       Worker output'unu okur
       A2A: workerlara geri dönüp soru sorabilir
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
       (Follow-up: cached output üzerinden cevap, hızlı)
```

### Gözlemler

- **Total süre:** ~23 saniye ilk tam tez için *(idealize edilmiş; gerçekte 40-60s, bkz. Bölüm 3, madde #6)*.
- **Follow-up sorular:** 2–5 saniye (cache + targeted reasoning).
- **Token tüketimi:** ~17K input, 5.5K output → ~$0.02 per tez (Flash-mix).

## 2.7 Persistence Şemaları

### PostgreSQL — Ana Tablolar

```sql
-- Kullanıcılar
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  tier TEXT,         -- 'free' | 'pro' | 'b2b'
  created_at TIMESTAMPTZ
);

-- Watchlist
CREATE TABLE watchlist (
  user_id UUID REFERENCES users(id),
  ticker TEXT,
  added_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, ticker)
);

-- Tezler
CREATE TABLE theses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  ticker TEXT,
  thesis_date TIMESTAMPTZ,
  thesis_md TEXT,
  bull_points JSONB,
  bear_points JSONB,
  catalysts JSONB,
  confidence FLOAT,
  embedding VECTOR(768),     -- pgvector
  price_at_thesis NUMERIC,
  price_7d NUMERIC,
  price_30d NUMERIC,
  price_90d NUMERIC,
  outcome TEXT               -- 'correct' | 'partial' | 'wrong' | 'pending'
);

-- Tool çağrı logları (citation tracing)
CREATE TABLE tool_call_logs (
  call_id UUID PRIMARY KEY,
  thesis_id UUID REFERENCES theses(id),
  agent_id TEXT,
  tool_name TEXT,
  args JSONB,
  result JSONB,
  ts TIMESTAMPTZ
);

-- Embedding similarity index
CREATE INDEX idx_theses_embedding ON theses
USING ivfflat (embedding vector_cosine_ops);
```

### Redis — Anahtar Şemaları

```
macro:context                 # 15dk TTL, makro context paragraf
yfinance:{ticker}:ohlcv:90d   # 15dk TTL, OHLCV cache
kap:{ticker}:filings:30d      # 1h TTL, KAP cache
agent:state:{session_id}      # konuşma bağlamı
ws:channel:{user_id}          # WebSocket pub/sub
```

## 2.8 Teknoloji Yığını

```toml
[backend]
python = "^3.11"
fastapi = "*"
uvicorn = "*"

[ai]
strands-agents = "*"
strands-agents-tools = "*"
google-generativeai = "*"
chromadb = "*"          # opsiyonel; pgvector tercih edilir

[data]
yfinance = "*"
ta-lib = "*"            # alternatif: pandas-ta (saf Python, kurulum kolay)
beautifulsoup4 = "*"
httpx = "*"
pandas = "*"
pydantic = "*"

[persistence]
sqlalchemy = "*"
psycopg2-binary = "*"
redis = "*"
pgvector = "*"          # PostgreSQL'de embedding

[observability]
opentelemetry = "*"     # Strands native destekler
structlog = "*"

[frontend]
# Next.js 15, Tailwind, shadcn/ui, recharts
# WebSocket: native + socket.io fallback
```

### Kütüphane Seçim Gerekçeleri

| Kütüphane | Niye seçildi | Alternatifi |
|---|---|---|
| `strands-agents` | Multi-agent pattern desteği, tool sistemi olgun | LangGraph, CrewAI, AutoGen |
| `google-generativeai` | Gemini 2.5 ailesi maliyet/kalite oranı yüksek | OpenAI SDK, Anthropic SDK |
| `pgvector` | Tek DB içinde hibrit RAG | Chroma (ayrı servis), Qdrant |
| `yfinance` | BIST tickerları `.IS` suffix ile destekli, ücretsiz | TwelveData (paid), AlphaVantage (limit) |
| `ta-lib` | 60+ pattern fonksiyonu hazır | `pandas-ta` (kurulumu kolay, biraz daha yavaş) |
| `httpx` | Async HTTP, KAP/news scraping için ideal | requests (sync), aiohttp |
| `pydantic` | Strands ve FastAPI ile ortak schema dili | dataclasses + manual validation |
| `structlog` | JSON-format log, observability'e doğal | logging stdlib |

## 2.9 Deploy Mimarisi

### Geliştirme

Docker Compose ile **5 container**:

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ postgres   │  │ redis      │  │ chromadb   │  (ops.)
└────────────┘  └────────────┘  └────────────┘
       ▲              ▲              ▲
       └──────────────┼──────────────┘
                      │
              ┌───────┴───────┐
              │   backend     │  (FastAPI + Strands)
              └───────┬───────┘
                      │
              ┌───────┴───────┐
              │   frontend    │  (Next.js)
              └───────────────┘
```

### Demo Deploy

| Bileşen | Servis | Plan |
|---|---|---|
| Backend | Railway veya Fly.io | Free tier, Python desteği iyi |
| Frontend | Vercel | Next.js native, ücretsiz hobby |
| PostgreSQL | Supabase | Free tier, **pgvector built-in** |
| Redis | Upstash | Free tier, serverless |
| ChromaDB | Backend container içinde embedded | Ayrı servis maliyeti yok |
| Storage (PDF) | S3 / MinIO | Free tier yeterli |

**Hackathon süresince tahmini maliyet:** ~$0-5 (free tier'lar genelde yeter).

## 2.10 Risk ve Azaltma Tablosu

| # | Risk | İhtimal | Etki | Azaltma |
|---|---|---|---|---|
| 1 | KAP scraper kırılır | Yüksek | Orta | Önceden 90 gün veri cache'le, fallback static dataset |
| 2 | Gemini rate limit | Orta | Yüksek | Exponential backoff, Flash öncelikli; **paid tier** (çoklu key yerine) |
| 3 | TA-Lib kurulum sorunu (Linux) | Yüksek | Orta | Docker image hazırla; `pandas-ta` fallback |
| 4 | Citation enforcement kısır döngü | Orta | Yüksek | Max 2 retry, sonra warning ile geç (soft mode) |
| 5 | Devil's Advocate prompt zayıf | Orta | Yüksek | 3-4 prompt versiyonu test et, en iyisini seç |
| 6 | Demo'da BIST kapalı | Düşük | Orta | Pre-recorded session + canlı simülasyon backup |
| 7 | Strands A2A protocol olgun değil | Orta | Orta | Agent-as-Tool fallback'e hazır ol |
| 8 | KAP scraper ToS | Düşük | Yüksek (legal) | KAP API arayışı; rate-limit dostu user-agent |
| 9 | Twitter/X API maliyeti | Yüksek | Düşük | v2'ye ertele veya Reddit / forum scrape |

---

# BÖLÜM 3 — Eleştirel İnceleme: Düzeltilmesi Gereken Kısımlar

> Aşağıdaki maddeler, mevcut prompt.md tasarımında **tespit ettiğim tutarsızlıklar, açık uçlar, scope/regülasyon riskleri ve önerilen düzeltmeler**dir. Format her madde için: **Sorun → Etkisi → Önerilen Çözüm**.

### 1. Memory Storage Tutarsızlığı (ChromaDB vs pgvector)

- **Sorun:** §2.1 mimari diyagramında *"ChromaDB (embedded thesis memory, RAG context)"* yazıyor. Ancak §2.6 teknoloji yığınında `pgvector = "*"  # PostgreSQL'de embedding` listelenmiş. Aynı zamanda §2.9 deploy mimarisinde Supabase'in pgvector built-in olduğu vurgulanmış. **Hem ChromaDB hem pgvector seçilmiş gibi görünüyor.**
- **Etkisi:** İki ayrı embedding store'un yönetimi karmaşıklık katar; veriler iki yerde tutulursa senkronizasyon problemi çıkar. Hackathon scope'unda lüks.
- **Önerilen Çözüm:** **Tek seçenek olarak pgvector** kullan. Gerekçe: (i) PostgreSQL zaten var, ek servis maliyeti yok; (ii) Supabase'in built-in pgvector desteği deploy'u basitleştirir; (iii) Hibrit RAG (ilişkisel + vector) tek connection üstünden. ChromaDB'yi sadece performans sorunu çıkarsa fallback olarak değerlendir.

### 2. Olmayan Gemini Modelleri Referansları

- **Sorun:** prompt.md'de Agent 6 (Devil's Advocate) için *"Gemini 2.5 Pro veya 3 Flash"*, Agent 8 (Synthesizer) için *"Gemini 2.5 Pro veya 3.1 Pro"* yazılmış. Ocak 2026 itibarıyla **Gemini 3 Flash veya 3.1 Pro yok**; mevcut aile: Gemini 2.5 Pro / Flash / Flash-Lite.
- **Etkisi:** Geliştirme aşamasında "model bulunamadı" hatası, dokümantasyonun güvenilirliği zedelenir.
- **Önerilen Çözüm:** Tüm referansları **Gemini 2.5 Pro / Flash / Flash-Lite** olarak normalize et. Devil's Advocate ve Synthesizer için **Gemini 2.5 Pro** sabit; diğerlerinde Flash. Yeni model çıkarsa bir "model registry" config'i ile değiştirilebilir tut.

### 3. Conservative Mode — Tanıtılmış Ama Tasarlanmamış

- **Sorun:** Persona 3 (Ali Bey) için *"Conservative mode — bear case'i daha ağırlıklı görsün, temettü güvenliği vurgulansın"* deniyor. Ancak Synthesizer prompt'unda, Orchestrator akışında veya UI tarafında bu mode'un nasıl tetikleneceği, ne yapacağı tanımsız.
- **Etkisi:** Persona vaat ediliyor ama feature yok — judge sorduğunda boşluk çıkar.
- **Önerilen Çözüm:** Synthesizer prompt'una `user_mode: "default" | "conservative"` parametresi ekle. Conservative mode'da: (i) bear case başa al, (ii) güven skoru üst sınırını 70'e çek, (iii) temettü ve volatilite başlıklarını öne çıkar. Orchestrator user profilinden `conservative` flag'ini geçer. UI'da basit toggle.

### 4. Twitter/X Sentiment — Maliyet Sorunu

- **Sorun:** Agent 5'in `social_sentiment_trend(ticker)` tool'u Twitter/X'i hedefliyor. Twitter API artık **Basic tier $100+/ay**, hackathon ve free-tier projesi için sürdürülebilir değil.
- **Etkisi:** Demo'da çalışmaz veya tek seferlik bir Pro key ile çalışsa bile post-hackathon ürünleştirme aşamasında patlar.
- **Önerilen Çözüm:** Hackathon scope'undan **Twitter sentiment çıkar**, "v2 roadmap" işaretle. Yerine: (i) Reddit Türkçe yatırım subreddit'leri (`r/borsaistanbul`), (ii) Ekşi Sözlük başlık akışı (yarı-yapılandırılmış scrape), (iii) Telegram public kanal mesajları. Bunlar ücretsiz erişilebilir ve Türkçe içerik için zaten daha zengin.

### 5. Çoklu Gemini API Key Rotasyonu — ToS Riski

- **Sorun:** §2.10 risk tablosunda *"3 farklı API key, exponential backoff, Flash öncelikli"* yazıyor. Google AI Studio ToS'una göre tek hesap altında çoklu key kullanımı rate-limit aşma amacıyla problemlidir; abuse olarak işaretlenebilir.
- **Etkisi:** Hesap askıya alınma, hackathon ortasında demo'nun patlama riski.
- **Önerilen Çözüm:** **Tek hesap + tek key + paid tier**. Free tier'da 60 RPM yeterli olmazsa Tier 1 ($) yeterli olur. Ayrıca: (i) Macro Context için 15dk cache (zaten var), (ii) yfinance/KAP cache'i agresif kullan, (iii) worker-level paralelliği gerektiğinde bekleme ile zamanla.

### 6. 23 Saniye Süre İddiası — Çok İyimser

- **Sorun:** §2.6'daki sequence diagram ilk tam tezi 23 saniyede üretiyor. Ancak: (i) 3 paralel worker'ın her biri 5-10 tool çağrısı yapıyor, (ii) Devil's Advocate worker output'unu okuyup A2A ile geri soru soruyor, (iii) Synthesizer streaming + citation validation. Pratikte **Gemini 2.5 Pro tek başına 8-15s sürebiliyor**.
- **Etkisi:** Demo'da gerçek süre 40-60s çıkarsa "23 saniye" iddiası utanç verici olur. Sunum tempo planlaması zedelenir.
- **Önerilen Çözüm:** (i) Beklenen süreyi **40-60s** olarak ilan et, hızlı çıkarsa bonus. (ii) Demo'da kullanılacak hisseler için **pre-warmed cache** hazırla. (iii) UI'da "thinking" durumlarını detaylı göster — kullanıcı 60s'i 23s gibi hisseder. (iv) Worker'ların max tool call'unu 5 ile sınırla.

### 7. Strands A2A Protocol — Olgunluk Riski

- **Sorun:** Devil's Advocate'in `query_workers()` tool'u Strands'in A2A (Agent-to-Agent) protokolüne dayanıyor. Strands'in A2A katmanı henüz olgunluk açısından risk taşıyor (versioning, tool re-entrancy, error propagation).
- **Etkisi:** Hackathon ortasında bu API'da hata varsa Devil's Advocate demo'nun ayrıştırıcı feature'ı patlar.
- **Önerilen Çözüm:** **Plan B'yi default yap:** Devil's Advocate worker output'unu **read-only** olarak alır, ek soru sormak yerine `find_disconfirming_evidence` ve `base_rate_check` tool'larını doğrudan çağırır. "A2A query" feature'ını sadece zaman kalırsa ekle. Bu, mimariyi basitleştirir ve daha deterministik çalışır.

### 8. Backtest Validator vs Memory Agent — Sorumluluk Çakışması

- **Sorun:** Agent 9 (Backtest Validator) "geçmişe gidip ne demiş olurduk" sorusunu cevaplıyor. Agent 7 (Memory Agent) **zaten** geçmiş tezlerin ground truth'unu yfinance'den update ediyor (gece cron). İki yer overlap ediyor.
- **Etkisi:** Geliştirici hangi sorumluluğun nerede olduğunu kaybeder, kod tekrarı, demo'da hangisinin gösterileceği belirsiz.
- **Önerilen Çözüm:** Net ayrım:
  - **Memory Agent:** Geçmişte **gerçekten yazılmış** tezlerin ground truth'unu update eder. "ASELS için 6 ay önce yazdığım tez" gibi.
  - **Backtest Validator:** Hiç yazılmamış bir tezi **as-of-date** ile **simulate** eder. Geçmişe yapay olarak gidip "ne yazardık" sorusunu cevaplar.
  - Kod organizasyonu: Backtest Validator kendi `as_of_date` parametresini tüm pipeline'a inject eder; Memory Agent sadece DB'deki kayıtları okur/yazar.

### 9. Citation Enforcement — Sonsuz Döngü Riski

- **Sorun:** Synthesizer her başarısız citation validation'da regenerate ediyor. Worker output'u zayıf ise (Gemini 2.5 Pro bile zaman zaman hallucinate ediyor), Synthesizer her seferinde aynı hatayı yapabilir → sonsuz döngü.
- **Etkisi:** Tek bir tez talebinde 3-4 dakika gecikme + dolu rate limit + kullanıcı kaybı.
- **Önerilen Çözüm:** **Soft enforcement politikası:**
  1. İlk validation hatasında: Synthesizer'a *"şu kaynaklar geçersiz, düzelt"* feedback'i ile **bir kez** retry.
  2. İkinci hatada: Geçersiz citation'ları **uyarı kutusuyla** (`[KAYNAKSIZ]`) işaretle ve kullanıcıya görünür sun.
  3. Loglarla geçersiz citation paternlerini izle, prompt'u iyileştir.
  - Ayrıca: Worker output'unda zaten `citation_call_id` zorunlu olduğu için ID-bazlı validation **deterministik**. Sayısal sanity check ayrı katman; fail olursa sadece flag, regenerate yok.

### 10. TA-Lib Bağımlılığı — Linux'ta Acı

- **Sorun:** TA-Lib **C kütüphanesi**, Linux'ta `apt install ta-lib-dev` + Python wrapper kuruluyor; Docker image'da derleme zaman alır, Mac/Windows farkları var.
- **Etkisi:** 10 günlük scope'ta saatler kaybedilebilir, demo deploy'unda Railway/Fly.io image build hatası riski.
- **Önerilen Çözüm:** **`pandas-ta`** kullan. Saf Python, `pip install pandas-ta`, 130+ indikatör hazır, RSI/MACD/Bollinger/ATR aynı API'lar. Hız farkı hackathon scope'unda hissedilmez. TA-Lib'in pattern recognition'ı için `pandas-ta`'da yeterli alternatifler var; gerekirse manuel pattern detection yazılabilir.

### 11. Sektör Squad'ları — Kapsam ve Sınıflandırma Hataları

- **Sorun:** Sadece 3 squad (Banking, Defense/Industrial, Retail/Consumer) + Generic. **TUPRS** (rafineri, enerji devi) Defense/Industrial içinde listelenmiş — bu yanlış sınıflandırma. Enerji, GYO (Gayrimenkul Yatırım Ortaklığı), holding, telekom gibi büyük BIST sektörleri Generic'e düşüyor.
- **Etkisi:** Hackathon demosunda yanlış squad atamaları olursa worker'ların özelleşmiş prompt'ları yanlış metrikleri sorgular (TUPRS'a NIM bakmak gibi).
- **Önerilen Çözüm:** En az **5 squad** olsun:
  1. Banking
  2. Energy & Utilities (TUPRS, AKSEN, AKSA, ZOREN)
  3. Defense & Industrial (ASELS, OTKAR, EREGL, KCHOL)
  4. Retail & Consumer (BIMAS, MGROS, SOKM, ULKER, CCOLA)
  5. Real Estate / Holding (KCHOL holding hariç; EKGYO, ISGYO)
  6. Generic fallback
  - Statik mapping dosyası (`sector_map.yaml`) hazırla, BIST'in en aktif 50 hissesini kapsa.

### 12. KAP Scraper Legal/ToS

- **Sorun:** KAP'ın `kap.org.tr` sitesi public, ama **scraping ToS'unda** "otomatik erişim yasak/sınırlı" maddesi olabilir. Risk tablosunda **legal risk olarak listelenmemiş**.
- **Etkisi:** Hackathon kapsamında düşük risk, ama ürünleştirmede ciddi engel; KAP Cease-and-Desist gönderebilir.
- **Önerilen Çözüm:** (i) KAP'ın resmi/yarı-resmi API'sini araştır (RSS feed'leri var). (ii) Saygılı scrape: `User-Agent` belirgin, request rate düşük (1 req/saniye), `robots.txt` saygısı. (iii) Risk tablosuna **"KAP scraping legal status"** maddesi ekle. (iv) Ürünleştirme için yıllık KAP veri lisansı (varsa) bütçele.

### 13. HashTrade Referansı — Resmi Raporda Yer Bulmamalı

- **Sorun:** prompt.md'nin §1.5 rakipler tablosunda *"HashTrade (kendi projen) — Crypto + execution"* yazıyor. Kişisel proje referansı resmi proje raporunda profesyonel görünmüyor; judge'lar için karışıklık yaratır.
- **Etkisi:** Sunumun ciddiyetini düşürür.
- **Önerilen Çözüm:** HashTrade'i rakipler tablosundan çıkar; isteniyorsa "ekibin önceki tecrübesi" başlığı altında ayrı bir kısa nota dönüştür ("Ekip daha önce HashTrade adlı crypto execution platformunu geliştirdi, bu deneyim PWA/WebSocket altyapısında doğrudan kullanılıyor.").

### 14. 10 Günlük Scope Timeline'ı Yok

- **Sorun:** Hackathon 10 gün, ama prompt.md'de **gün-gün sprint planı yok**. Hangi feature MVP, hangi nice-to-have belirsiz.
- **Etkisi:** Geliştirme sırasında scope creep, son 2 gün panik, demo'da yarım feature'lar.
- **Önerilen Çözüm — Önerilen Sprint Planı (örnek):**

| Gün | Hedef | Çıktı |
|---|---|---|
| 1 | Repo, Docker compose, FastAPI iskeleti, Gemini bağlantı testi | `hello world` agent çalışıyor |
| 2 | yfinance + KAP scraper + Macro Context Agent | Tek tool, JSON çıktı |
| 3 | Sector Router + Technical Worker | Bir hisse için teknik analiz çıktı |
| 4 | Fundamental Worker + Sentiment Worker | 3 worker paralel çalışıyor |
| 5 | Devil's Advocate (basit, A2A'sız) + Synthesizer | İlk tam tez Markdown |
| 6 | Citation validator + Memory Agent (write only) | Tezler DB'ye yazılıyor |
| 7 | Frontend: Watchlist + Chat + Thesis Viewer | UI canlı |
| 8 | WebSocket stream + Memory similarity search | Geçmiş tezler görünüyor |
| 9 | Demo polish + Pre-warmed cache + Conservative mode | Demo akıcı |
| 10 | Sunum hazırlığı, video kayıt, fallback senaryolar | Submission |

**MVP feature listesi (gün 6 sonu):**
1. Tek hisse için bull/bear/catalysts tezi.
2. Citation-grounded.
3. Bir geçmiş tez similarity match.

**Nice-to-have (gün 7+):**
- Backtest Validator.
- Conservative mode toggle.
- A2A protocol.
- Multi-user watchlist.
- B2B white-label görünüm.

### 15. Test Stratejisi Yok

- **Sorun:** prompt.md'de pytest, fixture, mock, CI'ya dair **hiç bahis yok**. Citation validator, sector router, ground truth update gibi kritik bileşenler test edilmeden demo'ya çıkarsa risk.
- **Etkisi:** Demo'da regresyon, refactor korkusu, judge sorularına ("kapsama oranınız ne?") cevap yok.
- **Önerilen Çözüm:**
  - **Unit testler (öncelik):**
    - `validate_citations()` — bilerek bozuk citation'lı tez ile test.
    - Sector Router — 50 BIST hissesi için doğru squad mı dönüyor.
    - `compute_ratios()` — bilinen finansal tabloyla karşılaştır.
  - **Integration testler:**
    - Bir hisse için end-to-end pipeline (mock LLM ile).
    - Memory similarity — 3 fake tez insert et, similarity sorgusu beklenen sırayı versin.
  - **Smoke testler:**
    - 5 popüler BIST hissesi için tam pipeline'ı CI'da çalıştır (gerçek LLM ile, gece cron).
  - **CI:** GitHub Actions, PR'da unit + integration; nightly smoke.
  - Kapsama hedefi: kritik path'lerde **>%70**.

---

## Kapanış Notları

**ThesisForge tasarımı temelde sağlam:** Multi-agent komite metaforu ürün vizyonu ile tutarlı, citation-grounded mimari halüsinasyon riskine karşı doğru cevap, Memory Agent demo için güçlü bir wow-factor. Ancak yukarıdaki 15 maddenin **en az ilk 10'u** hackathon başlamadan **karara bağlanmalı** — özellikle:

- **#1 (pgvector tek seçenek)**, **#2 (model isim normalizasyonu)**, **#10 (pandas-ta)**: bu 3 madde ilk gün düzeltilirse kurulum ve dağıtım çok hızlanır.
- **#7 (A2A fallback)**, **#9 (citation soft mode)**, **#14 (timeline)**: bu 3 madde scope kontrolü için kritik.
- **#3 (conservative mode)**, **#11 (squad genişlet)**, **#15 (test)**: bu 3 madde demo kalitesini belirler.

Geri kalan maddeler (Twitter çıkar, KAP legal, çoklu key gibi) ürünleştirme aşamasında bağlanır.
