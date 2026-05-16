# Frontend V2 (Aydınlık Tema / Midas Stili) Yönergeleri

Bu klasör (`frontend_v2`), uygulamanın orijinal **Karanlık Temasını (TradingView/Bloomberg)** bozmadan, tamamen **Aydınlık Temada (Midas Stili)** nasıl görüneceğini test etmek amacıyla oluşturulmuştur.

## Neler Değişti?

### 1. Küresel Renk Değişkenleri (`globals.css`)
Orijinal karanlık tonlar (`#0C1428`, vb.) yerine tamamen beyaz ve açık gri tonlarına geçiş yapıldı:
- **Arka Plan:** Beyaz (`#FFFFFF`) ve açık gri (`#F8FAFC`).
- **Metinler:** Koyu slate (gri-siyah) (`#0F172A` ve `#334155`).
- **Sınırlar ve Çizgiler:** Açık gri (`#E2E8F0`).
- **Glass Efektleri:** Koyu yarı-saydam yerine, beyaz yarı-saydam buzlu cam (`bg-white/80`) efekti uygulandı.
- **Aurora ve Grid Arka Planları:** Koyu parlak gradyanlar çok daha hafif ve soluk hale getirildi.

### 2. Bileşen Düzeltmeleri (Kapsamlı Tarama)
Uygulama ve pazarlama sayfalarındaki **tüm** bileşenlerde koyu tema kalıntıları temizlendi:

**Marketing (Pazarlama) Sayfaları:**
- `Hero.tsx`: Başlık ve açıklama metinleri `text-slate-900` yapıldı, butonlar beyaz arka plana alındı.
- `FeatureGrid.tsx`: Kartlar beyaz arka plan + `shadow-sm` olacak şekilde güncellendi.
- `AgentShowcase.tsx`: Ajan kartları beyaz zemine alındı.
- `HowItWorks.tsx`: Bölüm arka planı `bg-slate-50` yapıldı, adım ikonları beyaz kutu içine alındı.
- `DataSources.tsx`: Kaynak ikonları `bg-blue-50 text-blue-600` olarak güncellendi.
- `CtaBand.tsx`: Butonlar beyaz/açık gri sınırlarla yenilendi.
- `MarketingFooter.tsx`: Footer arka planı `bg-slate-50` yapıldı.
- `MarketingHeader.tsx`: Scrollspy aktif linki `bg-blue-50 text-blue-700` yapıldı.
- `MiniLiveDemo.tsx`: Demo panel arka planları beyaz/slate yapıldı.

**App (Uygulama) Bileşenleri:**
- `Sidebar.tsx`: Tam beyaz arka plan, aktif menü `bg-blue-50 text-blue-700` yapıldı.
- `Topbar.tsx`: Üst bar beyaz arka plan, arama kutusu açık gri yapıldı.
- `MarketPulse.tsx`: Grafik arka planı beyaz, ECharts tooltip beyaz yapıldı.
- `AgentActivityFeed.tsx`: Aktivite kartı beyaz arka plan yapıldı.
- `WatchlistStrip.tsx`: Watchlist kartları açık gri yapıldı.
- `ThesisSkeleton.tsx`: İskelet yükleyici `slate-100/200` tonlarıyla güncellendi.
- `DraggableDashboard.tsx`: Grip kulpları açık gri yapıldı.
- `UserMenu.tsx`, `NotificationPanel.tsx`, `CommandPalette.tsx`, `HistoryTable.tsx`, `SettingsPanels.tsx`: Tüm dropdown ve paneller beyaz/slate yapıldı.
- `AgentCard.tsx`, `ThesisCard.tsx`, `LiveThesisRunner.tsx`: Tüm kartlar beyaz arka plana alındı.
- `Breadcrumbs.tsx`, `ConfidenceBar.tsx`, `SourceChip.tsx`, `Stepper.tsx`: Metin ve arka plan renkleri güncellendi.
- `Logo.tsx`, `DisclaimerBlock.tsx`: Metin renkleri `text-slate-900` yapıldı.

### 3. Renk Kuralı
- **`text-white` → `text-slate-900`:** Beyaz arka planda okunabilir koyu metin.
- **`bg-[#0C1428]` vb. → `bg-white` veya `bg-slate-50`:** Temiz beyaz arka planlar.
- **`hover:text-white` → `hover:text-slate-900`:** Hover durumlarında koyu metin.
- **İstisna:** Renkli arka plan üzerindeki butonlar ve avatar gibi öğelerde `text-white` korunmuştur (örn. mavi buton üzeri beyaz yazı).

### 4. Port
- Orijinal proje: `localhost:3000`
- V2 proje: `localhost:3001`

## Nasıl Karşılaştırma Yapılır?
1. Terminalde `frontend` klasörüne gidip `npm run dev` → **localhost:3000** (Karanlık Tema).
2. Başka bir terminalde `frontend_v2` klasörüne gidip `npm run dev` → **localhost:3001** (Aydınlık Tema).
3. İki sekmeyi yan yana koyup karşılaştırın.
