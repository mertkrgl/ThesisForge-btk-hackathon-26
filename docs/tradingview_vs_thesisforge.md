# TradingView vs ThesisForge Mimari Karşılaştırması

Bu belge, dünyanın en popüler finansal grafik platformu **TradingView** ile geliştirmekte olduğunuz multi-agent yapay zeka karar destek sistemi **ThesisForge**'un teknik altyapılarını, işleyiş mantıklarını karşılaştırır ve ThesisForge projenizde kullanabileceğiniz TradingView yaklaşımlarını listeler.

---

## 1. Genel İşleyiş ve Hedef Kitle

### TradingView Nasıl İşliyor?
- **Odak Noktası:** Gerçek zamanlı veri görselleştirme, teknik analiz çizim araçları, sosyal ağ (fikir paylaşımı) ve anlık veri akışı.
- **Veri Tüketimi:** Saniyede binlerce fiyat hareketini (tick data) alır ve grafiğe hiç gecikmesiz (zero-latency) çizer.
- **Kullanıcı Etkileşimi:** Kullanıcı aktiftir; grafik çizer, indikatör ekler, kendi analizini kendi yapar.

### ThesisForge Nasıl İşliyor?
- **Odak Noktası:** LLM (Büyük Dil Modelleri) ve multi-agent sistemiyle otomatik finansal analiz, yatırım tezi üretimi ve karar destek sistemi.
- **Veri Tüketimi:** Temel (bilanço, haber, KAP) ve teknik (fiyat, hacim) verileri API'ler aracılığıyla toplar, bu verileri ajanlara (Agent) sunar. 
- **Kullanıcı Etkileşimi:** Kullanıcı pasiftir (talep edendir); hisse senedini seçer, sistem arka planda komite gibi tartışıp sonuçlanmış, doğrulanmış (citation-grounded) bir tez sunar.

---

## 2. Frontend Teknolojileri ve Arayüz Mimarisi

| Özellik | TradingView | ThesisForge | Karşılaştırma Analizi |
| :--- | :--- | :--- | :--- |
| **Temel Framework** | Vanilla JS (Saf JavaScript) | Next.js 15, React 19 | TradingView grafik performansı için React kullanmaz. ThesisForge ise içerik/metin/tez gösterimi yaptığı için React'in komponent mimarisine çok daha uygundur. |
| **Görselleştirme** | HTML5 Canvas & WebGL | SVG tabanlı `recharts` / `shadcn` | TradingView pikselleri doğrudan donanım gücüyle çizer (Canvas). ThesisForge HTML DOM elementleri veya SVG çizer (`recharts`). |
| **Veri Akışı (Streaming)** | Yüksek frekanslı WebSockets | SSE (Server-Sent Events) / WebSockets | TradingView fiyat akışı için kullanırken, ThesisForge LLM yanıtlarını (ajan tartışmalarını) ekrana akıtmak (streaming) için kullanır. |
| **Stilleme (CSS)** | Özel CSS/SASS, Inline Styles | Tailwind CSS | ThesisForge, modern web standartları olan Tailwind ile çok daha hızlı UI geliştirir. |

---

## 3. Backend ve Veri Yönetimi

### TradingView
- **Veri Kaynağı:** Doğrudan borsalardan (BIST, NASDAQ vb.) özel hatlarla alınan ham (raw) veriler.
- **Veritabanı ve Önbellek:** Veriler özel in-memory (RAM) veritabanlarında tutulur. C++ ve Erlang gibi dillerle yazılmış, saniyelik on binlerce isteği kaldıracak cluster'lar kullanılır.
- **Sunucu:** Sunucu sadece veriyi basar, tüm çizim ve hesaplama yükü istemcinin (kullanıcının) tarayıcısındadır.

### ThesisForge
- **Veri Kaynağı:** MKK, TCMB EVDS, İş Yatırım, Yahoo Finance (REST API'ler ve Web Scrape).
- **Backend Framework:** Python (FastAPI). Yapay zeka orkestrasyonu (Strands) için Python en iyi tercihtir.
- **Veritabanı:** PostgreSQL (pgvector ile vektörel arama) ve Redis (Önbellekleme). Hafıza (Memory Agent) yönetimi için mükemmel bir modern yapay zeka yığını.
- **Sunucu:** Asıl yük LLM (Gemini) sağlayıcısında ve arka plandaki Python worker'larında (Technical / Fundamental) gerçekleşir.

---

## 4. ThesisForge Projesinde Hangi TradingView Teknolojileri / Yaklaşımları Kullanılabilir?

Projenizin `BLUEPRINT.md` ve klasör yapısını incelediğimde, frontend tarafında `recharts` kullanmayı planladığınızı görüyorum. ThesisForge'u çok daha profesyonel ve "TradingView hissiyatlı" bir hale getirmek için şu yaklaşımları projenize entegre edebilirsiniz:

### 1. `recharts` Yerine TradingView Lightweight Charts Kullanımı
ThesisForge'da hissenin fiyat grafiğini, teknik ajanların (Technical Worker) bulgularıyla birlikte gösterirken standart `recharts` (SVG tabanlı) kullanmak yerine, TradingView'in açık kaynaklı **Lightweight Charts** kütüphanesini kullanabilirsiniz.
- **Neden?** Recharts finansal mum grafikleri (candlestick) için optimize edilmemiştir ve çok veri gelirse kasar. TradingView Lightweight Charts ise Canvas tabanlıdır, çok hızlıdır ve tam bir finansal platform hissiyatı verir.
- **Nasıl Uygulanır?** Next.js projenizde `npm install lightweight-charts` ile ekleyip, React komponenti içine sararak kullanabilirsiniz.

### 2. Finansal Veriler İçin Canvas Odaklı Rendering
Eğer `recharts` kullanmaya devam edecekseniz bile, AI ajanlarınız 10 yıllık bilanço veya hacim verisi getirdiğinde DOM şişmesi yaşayabilirsiniz. SVG yerine Canvas ile render eden kütüphanelere (örneğin Apache ECharts) geçiş yapmak, uygulamanızın TradingView gibi akıcı olmasını sağlar.

### 3. WebSockets'in İkili (Dual) Kullanımı
Şu an projenizde muhtemelen ajanların konuşmalarını ekrana akıtmak (streaming) için WebSocket kullanacaksınız (Gün 5 planınızda var).
- **TradingView Yaklaşımı:** LLM tezi üretirken (bu yaklaşık 50-52 saniye sürüyor), kullanıcının canı sıkılmasın diye o hissenin **canlı (veya gecikmeli) fiyat verisini** bir WebSocket üzerinden (örneğin Yahoo Finance websocket'i veya basit bir long-polling) ekrandaki grafiğe aktarabilirsiniz. Tez oluşturulurken fiyatın sağ tarafta "tik" atarak değişmesi, uygulamanın dinamik hissini inanılmaz artırır.

### 4. Teknik İndikatörleri Frontend'de (Kullanıcı Tarayıcısında) Hesaplama
ThesisForge'da `pandas-ta` kullanarak backend'de (Technical Worker) indikatör hesaplıyorsunuz. Bu AI'ın yorumlaması için harika. Ancak:
- **TradingView Yaklaşımı:** Grafikte gösterilecek bir hareketli ortalama (SMA) çizgisini backend'de hesaplayıp frontend'e JSON ile göndermek sunucuyu yorar. Bunun yerine sadece ham fiyatı frontend'e yollayıp, SMA hesabını kullanıcının tarayıcısında (JavaScript ile) yaparsanız sunucu maliyetleriniz azalır ve performansınız artar.

### 5. Komponent Yapısı: Widget Mantığı
TradingView arayüzü birbirinden bağımsız "Widget"lardan (Araçlardan) oluşur. Haberler bir widget, grafik bir widget, fikirler bir widget'tır.
- ThesisForge arayüzünüzü (Next.js) tasarlarken; *Macro Context*, *Technical Analysis*, *Fundamental Analysis* ajanlarının çıktılarını **bağımsız widget kartları** olarak tasarlayın. Kullanıcı tıpkı TradingView'da olduğu gibi bu kartların yerini değiştirebilsin veya büyütebilsin. Bu, "Profesyonel Karar Destek Sistemi" algısını güçlendirir.
