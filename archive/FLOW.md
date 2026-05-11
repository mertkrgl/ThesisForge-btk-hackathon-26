# ThesisForge — Uçtan Uca Akış Şemaları

> Bu dosya, `DECISIONS.md`'deki kararlara göre güncel proje akışını gösterir. Tüm diyagramlar Mermaid formatındadır; GitHub, VSCode (Markdown Preview Mermaid Support eklentisi) ve mermaid.live üzerinde render edilir.
>
> **Toplam ajan: 8** · **Paralel worker: 2** · **Vector store: pgvector** · **Tarih: 2026-05-10**

---

## 1. Üst Seviye Sistem Mimarisi

Kullanıcıdan veriye, ajanlardan persistence'a tüm bileşenler.

```mermaid
graph TB
    subgraph Client["İstemci Katmanı"]
        UI["Next.js 15 PWA<br/>(Watchlist · Chat · Thesis Viewer)"]
    end

    subgraph Gateway["API Gateway"]
        WS["WebSocket<br/>(streaming)"]
        REST["REST API<br/>(CRUD)"]
    end

    subgraph Backend["FastAPI Backend"]
        ORCH["🎯 Orchestrator<br/>(Gemini 2.5 Flash)"]

        subgraph Workers["Paralel Worker Squad'ı"]
            TECH["📊 Technical<br/>(Flash + pandas-ta)"]
            FUND["💰 Fundamental<br/>(Flash, sector-aware)"]
        end

        ROUTER["🧭 Sector Router<br/>(Flash)"]
        DEVIL["😈 Devil's Advocate<br/>(Gemini 2.5 Pro)"]
        SYNTH["✍️ Synthesizer<br/>(Gemini 2.5 Pro)"]
        MEM["🧠 Memory Agent<br/>(Flash)"]
        MACRO["🌍 Macro Context<br/>(Flash, 15dk cache)"]
    end

    subgraph Tools["Veri Kaynakları & Tool'lar"]
        YF["yfinance<br/>(fiyat, finansal)"]
        KAP["KAP RSS<br/>(+ saygılı scrape)"]
        NEWS["Haber API'leri<br/>(Macro için)"]
        TA["pandas-ta<br/>(indikatörler)"]
    end

    subgraph Persistence["Persistence Katmanı"]
        PG[("PostgreSQL<br/>+ pgvector<br/>(tezler · embeddings)")]
        REDIS[("Redis<br/>(cache · rate limit)")]
    end

    subgraph External["Dış Servisler"]
        GEMINI["Google Gemini API<br/>(Tier 1, paid)"]
        CRON["Gece Cron<br/>(Memory ground truth update)"]
    end

    UI -->|user query| WS
    UI -->|CRUD| REST
    WS --> ORCH
    REST --> ORCH

    ORCH --> ROUTER
    ROUTER -->|sector_map.yaml| Workers

    ORCH -.parallel.-> TECH
    ORCH -.parallel.-> FUND
    ORCH --> MACRO

    TECH --> YF
    TECH --> TA
    FUND --> YF
    FUND --> KAP
    MACRO --> NEWS

    Workers --> DEVIL
    DEVIL --> SYNTH
    MEM -.similarity.-> SYNTH
    SYNTH -->|streaming tokens| WS

    SYNTH --> PG
    MEM <--> PG
    Workers <--> REDIS
    MACRO <--> REDIS

    Backend -.LLM calls.-> GEMINI
    CRON -.nightly.-> MEM
    MEM -.fiyat update.-> YF

    classDef pro fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000
    classDef flash fill:#dbeafe,stroke:#3b82f6,color:#000
    classDef store fill:#dcfce7,stroke:#16a34a,color:#000
    class DEVIL,SYNTH pro
    class ORCH,TECH,FUND,ROUTER,MEM,MACRO flash
    class PG,REDIS store
```

**Lejant:**
- 🟡 **Sarı (Gemini 2.5 Pro):** Devil's Advocate + Synthesizer
- 🔵 **Mavi (Gemini 2.5 Flash):** Diğer 6 ajan
- 🟢 **Yeşil:** Persistence

---

## 2. Uçtan Uca Tez Üretim Akışı (Sequence Diagram)

**Senaryo:** Kullanıcı (Mehmet, Persona 1) chat'e *"ASELS analiz et"* yazıyor. Persona default mode (conservative kapalı). Pre-warmed cache miss.

```mermaid
sequenceDiagram
    autonumber
    participant U as Mehmet (UI)
    participant WS as WebSocket
    participant O as Orchestrator
    participant R as Sector Router
    participant T as Technical Worker
    participant F as Fundamental Worker
    participant M as Macro Context
    participant DA as Devil's Advocate (Pro)
    participant ME as Memory Agent
    participant S as Synthesizer (Pro)
    participant CV as Citation Validator
    participant DB as PostgreSQL+pgvector
    participant C as Redis Cache

    U->>WS: "ASELS analiz et"
    WS->>O: parse intent
    O->>U: "Tez hazırlanıyor..." (token 1)

    par Paralel başlangıç
        O->>R: ticker=ASELS, sector?
        R-->>O: squad=Defense&Industrial
    and
        O->>M: macro_context()
        M->>C: cache get (15dk TTL)
        alt cache hit
            C-->>M: cached macro
        else miss
            M->>M: TÜFE, USD/TRY, CDS, BIST100
            M->>C: cache set
        end
        M-->>O: macro snapshot
    and
        O->>ME: similar_thesis(ASELS, top_k=3)
        ME->>DB: vector similarity search
        DB-->>ME: 3 geçmiş tez
        ME-->>O: "6 ay önce AL, %18 getirili"
    end

    par Paralel worker'lar (max 5 tool call her biri)
        O->>T: technical_analysis(ASELS, squad)
        T->>C: yfinance cache
        T->>T: pandas-ta (RSI, MACD, Bollinger)
        T-->>O: signals + citation_call_id'ler
    and
        O->>F: fundamental_analysis(ASELS, squad=Defense)
        F->>C: KAP cache
        F->>F: backlog, R&D, kâr marjı
        F-->>O: ratios + citations
    end

    O->>DA: tüm worker output'ları
    Note over DA: Gemini 2.5 Pro<br/>Karşı argüman üret<br/>Bull case zayıf noktaları
    DA-->>O: bear arguments + güç skoru

    O->>S: {workers, devil, macro, memory, user_mode:default}
    Note over S: Gemini 2.5 Pro<br/>streaming Markdown
    loop Streaming token-by-token
        S-->>WS: partial tez
        WS-->>U: anlık görüntü
    end
    S->>O: tam tez (citations dahil)

    O->>CV: validate_citations(tez)
    alt Tüm citations geçerli
        CV-->>O: ✅ valid
    else 1+ geçersiz citation
        CV-->>O: ❌ invalid IDs: [...]
        O->>S: retry once + feedback
        S-->>O: regenerated tez
        O->>CV: re-validate
        alt Hala geçersiz (2. tur)
            Note over CV: [KAYNAKSIZ] flag ile devam
            CV-->>O: ⚠️ flagged + soft pass
        end
    end

    O->>DB: tezi yaz (embedding ile)
    O->>WS: "tamamlandı" event
    WS-->>U: final UI render

    Note over U,DB: ⏱️ Toplam: 40-60 saniye<br/>(pre-warmed cache hit'te <10s)
```

---

## 3. Sector Router & Squad Eşleme

Hangi hissenin hangi squad'a düştüğü, her squad'ın hangi metrikleri sorguladığı.

```mermaid
flowchart TD
    Start([Ticker geldi]) --> Lookup{sector_map.yaml<br/>içinde mi?}

    Lookup -->|Hayır| Generic[Generic Squad<br/>📋 Genel oranlar:<br/>P/E, P/B, ROE, EBITDA]
    Lookup -->|Evet| Squad{Hangi squad?}

    Squad -->|GARAN, AKBNK, ISCTR<br/>YKBNK, HALKB, VAKBN| Banking[🏦 Banking Squad<br/>📋 NIM, CAR, NPL,<br/>CASA oranı, kredi/mevduat]

    Squad -->|TUPRS, AKSEN, AKSA<br/>ZOREN, ENJSA, AYGAZ| Energy[⚡ Energy & Utilities<br/>📋 Refining margin,<br/>brent korelasyonu, kapasite]

    Squad -->|ASELS, OTKAR, EREGL<br/>KCHOL, KOZAL, KARSN| Defense[🛡️ Defense & Industrial<br/>📋 Backlog, R&D harcama,<br/>USD revenue %, sözleşmeler]

    Squad -->|BIMAS, MGROS, SOKM<br/>ULKER, CCOLA, ARCLK| Retail[🛒 Retail & Consumer<br/>📋 LFL büyüme, mağaza sayısı,<br/>sepet büyüklüğü, SSS]

    Squad -->|EKGYO, ISGYO, SAHOL<br/>AGHOL, DOHOL| RealEstate[🏢 Real Estate / Holding<br/>📋 NAV iskonto,<br/>portföy değeri, doluluk]

    Banking --> WorkerCall[Fundamental Worker'a<br/>squad-specific prompt geçir]
    Energy --> WorkerCall
    Defense --> WorkerCall
    Retail --> WorkerCall
    RealEstate --> WorkerCall
    Generic --> WorkerCall

    WorkerCall --> Done([Worker analizi yapıyor])

    style Banking fill:#ddd6fe
    style Energy fill:#fed7aa
    style Defense fill:#bfdbfe
    style Retail fill:#fce7f3
    style RealEstate fill:#d1fae5
    style Generic fill:#e5e7eb
```

**Senaryo örnekleri:**
- `GARAN` → Banking → "NIM 4.8%, CAR 16.2%, NPL %2.1, mevduat büyümesi YoY %42"
- `TUPRS` → Energy → "Refining margin $8.2/varil, brent ile 0.78 korelasyon, kapasite kullanım %92"
- `ASELS` → Defense → "Backlog $9.1B (3.2x revenue), R&D %7, USD revenue %58"

---

## 4. Citation Enforcement (1-Retry + Soft Flag)

```mermaid
stateDiagram-v2
    [*] --> Generated: Synthesizer tezi üretti

    Generated --> Validate1: Citation Validator
    Validate1 --> Pass1: ✅ Tüm ID'ler geçerli
    Validate1 --> Fail1: ❌ Geçersiz citation var

    Pass1 --> Persist: DB'ye yaz
    Persist --> [*]: Kullanıcıya gönder

    Fail1 --> Retry: Synthesizer'a feedback<br/>"şu ID'ler geçersiz, düzelt"
    Retry --> Validate2: Yeniden üret + valide et

    Validate2 --> Pass2: ✅ Düzeldi
    Validate2 --> Fail2: ❌ Hala geçersiz

    Pass2 --> Persist
    Fail2 --> SoftFlag: Geçersizleri<br/>[KAYNAKSIZ] etiketle
    SoftFlag --> LogPattern: Pattern'i logla<br/>(prompt iyileştirme için)
    LogPattern --> Persist

    note right of Fail2
        Sonsuz döngü riski yok.
        Kullanıcıya şeffaf uyarı.
        En kötü senaryo:
        ~5-8s ekstra
    end note
```

**Örnek `[KAYNAKSIZ]` çıktı:**
> "ASELS Q3'te %23 büyüdü [KAP-2024-Q3]. Yeni MILGEM sözleşmesi imzalandı [KAYNAKSIZ — doğrulanamadı]. R&D harcaması artıyor [KAP-2024-Q3]."

---

## 5. Memory Agent — Ground Truth & Similarity

İki paralel görev: yazma (real-time) ve okuma (similarity).

```mermaid
flowchart LR
    subgraph WriteFlow["Yazma Akışı (Real-time)"]
        S1[Synthesizer tez bitirdi] --> E1[Embed metni<br/>(text-embedding-3-large)]
        E1 --> W1[(pgvector'e yaz<br/>+ ticker, date, recommendation)]
    end

    subgraph ReadFlow["Okuma Akışı (Synthesizer'dan önce)"]
        Q1[Yeni tez talebi: ASELS] --> E2[Query embed]
        E2 --> S2[(pgvector similarity<br/>top_k=3)]
        S2 --> R1[3 geçmiş tez:<br/>ASELS 6 ay, KCHOL 3 ay, OTKAR 1 ay]
        R1 --> Inject[Synthesizer'a inject:<br/>'son 6 ay önce AL dedik, %18 getirili']
    end

    subgraph CronFlow["Gece Cron Akışı"]
        T1{{02:00 UTC<br/>her gece}} --> Fetch[DB'den tüm açık tezleri çek]
        Fetch --> Loop[Her tez için]
        Loop --> YF[yfinance: tarih sonrası fiyat]
        YF --> Calc[Getiri hesap:<br/>actual_return %]
        Calc --> Update[(DB update:<br/>ground_truth_return)]
        Update --> Loop
    end

    style WriteFlow fill:#fef3c7
    style ReadFlow fill:#dbeafe
    style CronFlow fill:#f3e8ff
```

**Senaryo — Memory inject örneği:**

Mehmet ASELS yazınca, Synthesizer prompt'una şu inject edilir:
```
[MEMORY CONTEXT]
- 6 ay önce ASELS için "AL @ 67₺" dedik. Bugün 79₺. Ground truth: +%18 getiri ✅
- 3 ay önce KCHOL (aynı squad) "TUT" dedik. Ground truth: +%2 getiri ✅
- Hisseyle ilgili tutarlılık: bull tezimiz tarihsel olarak doğrulandı.
```

---

## 6. Conservative Mode Akışı (Persona 3 — Ali Bey)

```mermaid
flowchart TB
    Start([Ali Bey 'TUPRS değerlendir' yazdı]) --> Profile{User profile<br/>conservative?}

    Profile -->|Hayır default| Default[Synthesizer<br/>user_mode=default]
    Profile -->|Evet conservative| Conservative[Synthesizer<br/>user_mode=conservative]

    Default --> DOut[📄 Tez:<br/>1. Bull case başta<br/>2. Confidence 85<br/>3. Catalysts vurgulu]

    Conservative --> COut[📄 Tez:<br/>1. ⚠️ Bear case başta<br/>2. Confidence cap=70<br/>3. 💰 Temettü güvenliği vurgulu<br/>4. 📉 Volatilite uyarısı<br/>5. 'Muhafazakar profil için uygunluk' özeti]

    DOut --> Render[UI render]
    COut --> Render

    Render --> Toggle[UI'da 'Conservative Mode' toggle<br/>Ali Bey isterse switch yapabilir]

    style Conservative fill:#fee2e2
    style COut fill:#fee2e2
    style Default fill:#dbeafe
    style DOut fill:#dbeafe
```

---

## 7. Veri Kaynakları & Cache Stratejisi

```mermaid
flowchart LR
    subgraph Sources["Birincil Kaynaklar"]
        YF[yfinance<br/>📈 fiyat, finansal]
        KAPRSS[KAP RSS<br/>📋 bildirimler]
        KAPSCRAPE[KAP Scrape<br/>1 req/sn, fallback]
        NEWS[Haber API<br/>📰 makro]
        GEMINI[Gemini API<br/>🤖 LLM]
    end

    subgraph Cache["Redis Cache"]
        C1[macro:bist100<br/>TTL 15dk]
        C2[fin:ASELS:Q3<br/>TTL 24sa]
        C3[news:macro<br/>TTL 1sa]
        C4[ratelimit:user:123<br/>TTL 1dk]
        C5[prewarm:demo:ASELS<br/>TTL ∞ demo süresi]
    end

    subgraph Storage["PostgreSQL + pgvector"]
        T1[(theses<br/>tezler)]
        T2[(thesis_embeddings<br/>vector)]
        T3[(citations<br/>kaynak ID-URL)]
        T4[(users + watchlist)]
        T5[(ground_truth<br/>nightly update)]
    end

    YF --> C2
    KAPRSS --> C2
    KAPSCRAPE -.fallback.-> C2
    NEWS --> C3
    GEMINI --> C4

    T1 -.embed.-> T2
    T1 -.references.-> T3
    T1 -.tracked by.-> T5

    Note1[Demo öncesi gün 9:<br/>5-10 popüler hisse için<br/>tüm pipeline pre-warm]
    Note1 -.populates.-> C5

    style Cache fill:#fef3c7
    style Storage fill:#dcfce7
```

---

## 8. Tam Senaryo Karşılaştırması

Üç farklı kullanıcı, üç farklı akış.

```mermaid
flowchart TB
    subgraph S1["🧑 Senaryo 1: Mehmet (Persona 1) — ASELS"]
        M1[default mode] --> M2[8 ajan tam pipeline]
        M2 --> M3[Memory: 6 ay öncesi AL +%18]
        M3 --> M4[Devil's Pro: Bear güç=orta]
        M4 --> M5[Synth Pro streaming]
        M5 --> M6[⏱️ ~52s · Bull başta]
    end

    subgraph S2["👵 Senaryo 2: Ali Bey (Persona 3) — TUPRS"]
        A1[conservative mode ON] --> A2[Pipeline + user_mode=conservative]
        A2 --> A3[Synthesizer: Bear başa,<br/>confidence cap=70,<br/>temettü vurgulu]
        A3 --> A4[⏱️ ~48s · Bear başta · 💰]
    end

    subgraph S3["⚡ Senaryo 3: Demo Hisse — Pre-warmed"]
        D1[Demo öncesi cache hazır] --> D2[Cache hit: tez instant]
        D2 --> D3[Memory inject still live]
        D3 --> D4[⏱️ <8s · 'wow' factor]
    end

    style S1 fill:#dbeafe
    style S2 fill:#fee2e2
    style S3 fill:#dcfce7
```

---

## 9. Gün-Gün Sprint Akışı (Görselleştirilmiş)

```mermaid
gantt
    title 10 Günlük Hackathon Sprint
    dateFormat YYYY-MM-DD
    axisFormat %d

    section Foundation
    Repo + Docker + Gemini bağlantı     :done, d1, 2026-05-11, 1d
    yfinance + KAP RSS + Macro Agent    :d2, after d1, 1d

    section Agent Pipeline
    Sector Router + sector_map.yaml     :d3, after d2, 1d
    Technical Worker (pandas-ta)        :d3
    Fundamental Worker (squad-aware)    :d4, after d3, 1d
    Devil's Advocate + Synthesizer      :d5, after d4, 1d
    Citation Validator + Memory write   :crit, mvp, after d5, 1d

    section Frontend
    Watchlist + Chat + Thesis Viewer    :d7, after mvp, 1d
    WebSocket + Memory similarity       :d8, after d7, 1d
    Conservative mode toggle            :d8

    section Polish
    Pre-warmed cache + Test paketi      :d9, after d8, 1d
    Sunum + Video + Submission          :crit, d10, after d9, 1d

    section Milestones
    MVP Hazır                           :milestone, after mvp, 0d
    Demo Hazır                          :milestone, after d9, 0d
    Submission                          :milestone, after d10, 0d
```

---

## 10. Tüm Sistemin Tek Satırda Özeti

```mermaid
flowchart LR
    U[👤 Kullanıcı]
    UI[🖥️ Next.js PWA]
    O[🎯 Orchestrator]
    R[🧭 Router → Squad]

    subgraph P["⚡ Paralel"]
        T[📊 Technical]
        F[💰 Fundamental]
        Mc[🌍 Macro]
        Me[🧠 Memory similarity]
    end

    D[😈 Devil Pro]
    S[✍️ Synth Pro]
    CV[✅ Citations<br/>1-retry + flag]
    DB[(🗄️ pgvector)]
    Cron[🌙 Nightly<br/>ground truth]

    U --> UI --> O --> R --> P --> D --> S --> CV --> DB
    DB -.write.-> Me
    Cron -.update.-> DB
    S -.streaming.-> UI -.live.-> U

    style D fill:#fef3c7
    style S fill:#fef3c7
    style DB fill:#dcfce7
```

---

## Özet Notlar

1. **Streaming:** Synthesizer (Pro) tokenleri WebSocket üstünden anlık iletir → 60s'de bile kullanıcı 5s'de ilk başlığı görür.
2. **Cache stratejisi:** macro 15dk, finansal 24sa, demo hisseleri pre-warmed ∞.
3. **Resilient citation:** Sonsuz döngü riski yok, max 1 retry, sonra `[KAYNAKSIZ]` flag.
4. **Memory iki yönlü:** Yazma (tez biter bitmez), okuma (yeni tez başlamadan similarity), update (gece cron).
5. **8 ajanın 2'si Pro:** Maliyet-kalite dengesi (Devil's Advocate + Synthesizer kritik kalite noktaları).
6. **Conservative mode:** Tek parametre (`user_mode`), Synthesizer'da branch — bear başta, confidence cap, temettü vurgulu.
