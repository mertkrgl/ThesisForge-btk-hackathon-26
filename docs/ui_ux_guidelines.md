# ThesisForge UI/UX ve Frontend Yönergeleri

Bu belge, ThesisForge projesinin profesyonel bir "TradingView" veya "Bloomberg Terminali" hissiyatı vermesi için alınan frontend mimari kararlarını ve stil yönergelerini içerir.

---

## 1. Veri Görselleştirme (Grafikler)

Projede varsayılan `recharts` kütüphanesi yerine, donanım hızlandırmalı ve çok daha profesyonel finansal grafikler çizebilen **Apache ECharts** (Canvas tabanlı) tercih edilmiştir.

*   **Paketler:** `echarts`, `echarts-for-react`
*   **Kullanım Amacı:** Basit çizgi veya alan grafikleri yerine, hisse senetleri için gerçekçi **Mum Grafikleri (Candlestick)** çizmek. Ajan çıktılarının hacmi arttığında DOM'un yavaşlamasını engellemek.

## 2. UI Bileşenleri ve Dashboard Yapısı

*   **shadcn/ui:** Projenin ana iskeleti olan shadcn/ui ile "Bento Grid" (Kutu Kutu Yerleşim) yapısı sürdürülecektir.
*   **Widget Mantığı:** Kullanıcıya tüm bilgiler tek bir sayfada düz metin olarak verilmek yerine, bağımsız çalışan kartlar (örneğin: `MarketPulse` kartı) halinde modüler olarak sunulur.

## 3. Profesyonel Renk Paleti ve Tipografi

Sıradan kırmızı/yeşil renkleri yerine, finans dünyasının göz yormayan semantik (anlamsal) renkleri kullanılmaktadır:

*   **Boğa (Yükseliş / Pozitif):** `#089981`
*   **Ayı (Düşüş / Negatif):** `#f23645`
*   **Arka Plan (Dark Mode):** `#0C1428` ve türevleri. Koyu tema (Dark Mode) bir seçenek değil, varsayılandır.
*   **Tipografi (Monospace):** Fiyatlar, yüzdeler ve tüm sayısal değerlerin alt alta hizalı ve okunaklı durması için Tailwind'in `font-mono` (`ui-monospace`, `JetBrains Mono` vb.) sınıfı zorunlu olarak kullanılır. Sayılarda `tracking-tight` ile daha sıkı bir görünüm tercih edilir.

## 4. Dinamik Dashboard (Sürükle-Bırak Layout)

Borsa terminali hissiyatını güçlendirmek için statik sayfa düzeni yerine **react-grid-layout** kullanılarak kullanıcıya pencereleri (widget) taşıma ve boyutlandırma özgürlüğü verilmiştir.
*   **Bileşen:** `DraggableDashboard.tsx`
*   **Mantık:** Ana Dashboard (`page.tsx`) içindeki grafikler ve aktivite akışları bağımsız grid öğeleri (grid-items) haline getirilmiştir. Her widget'ın sağ üst köşesinde bir taşıma kulbu (`drag-handle`) bulunur (`GripHorizontal` ikonu).

## 5. Mikro-Animasyonlar ve Bildirimler

Kullanıcıyı sistemin "canlı" ve "işlemde" olduğuna inandıran en önemli detaylar:

*   **Fiyat Flaşları:** Piyasadan gelen anlık değişimleri (veya WebSocket verilerini) simüle etmek/göstermek için kullanılır. Fiyat arttığında widget arkaplanı kısa bir süreliğine (400ms) **Boğa Rengi (`#089981/20`)**, düştüğünde **Ayı Rengi (`#f23645/20`)** olarak parlar. 
*   **İskelet Yükleyiciler (Skeleton Loaders):** LLM (Yapay Zeka) 50 saniyelik bir analiz yaparken ekran boş kalmaz. Kullanıcıyı bilgilendiren ve profesyonel görünen `ThesisSkeleton.tsx` bileşeni gösterilir. Üzerindeki *pulse (nabız)* animasyonları arka planda veri okunduğu hissiyatını verir.
*   **Lucide İkonları:** Tüm ikonlar `lucide-react` üzerinden sağlanır. Tasarımda tutarlılık ve aynı çizgi kalınlığının (stroke-width) korunması hedeflenir.

## 6. Teknik Notlar ve İstisnalar (Turbopack Uyumluluğu)

Geliştirme sürecinde modern Next.js 15 (Turbopack) yapısından kaynaklanan bazı kütüphane uyumsuzlukları tespit edilmiş ve şu şekilde çözülmüştür:

*   **React Grid Layout - WidthProvider:** `react-grid-layout` kütüphanesinin paketlenmiş ESM sürümünde `WidthProvider` adlı sarmalayıcı (wrapper) doğrudan dışa aktarılmadığı için Turbopack derleme hatası verir. Bu sorunu aşmak için `WidthProvider` yerine modern tarayıcı API'si olan **`ResizeObserver`** kullanılarak ekran genişliği manuel hesaplanmış ve `Responsive` bileşenine aktarılmıştır. Bu yöntem performans açısından da daha verimlidir.
*   **TypeScript Tanım Eksikliği:** `@types/react-grid-layout` paketinde `draggableHandle` özelliği (prop) tanımlı değildir. Ancak kütüphanenin kendisi bu özelliği destekler. Bu nedenle derleme hatasını önlemek amacıyla ilgili satırın üzerinde `// @ts-ignore` kullanılması projede kabul edilebilir bir istisnadır.

## 7. Scrollspy (Aktif Navigasyon İzleme)

Anasayfada kullanıcı deneyimini artırmak için statik menüler yerine sayfa kaydırmasını (scroll) izleyen dinamik bir Header (üst menü) yapısı kullanılmıştır.

*   **Bileşen:** `MarketingHeader.tsx` (Client Component)
*   **Mekanizma:** `IntersectionObserver` API'si kullanılarak kullanıcının ekranda hangi bölümü (`#urun`, `#ajanlar`, `#nasil-calisir`, `#kaynaklar`) görüntülediği tespit edilir.
*   **Görsel Geri Bildirim:** Aktif olan (ekranda görünen) bölümün menüdeki linki parlak (`bg-white/10 text-white`) hale gelirken, diğer linkler sönük (`text-text-2`) kalarak kullanıcının nerede olduğunu anlaması sağlanır.

---

*Not: Bu yönergeler `MarketPulse.tsx`, `ThesisSkeleton.tsx`, `DraggableDashboard.tsx` ve `MarketingHeader.tsx` bileşenleri üzerinde başarıyla uygulanmıştır. Projeye eklenecek yeni görselleştirme widget'larında da bu standartlara uyulmalıdır.*

## 8. Framer Motion ile Mikro-Animasyonlar

Projenin canlı ve modern bir his vermesi için sayfa içi animasyonlarda **Framer Motion** kullanılmıştır. CSS transition'larının yetersiz kaldığı durumlarda, orkestre edilmiş (staggered) animasyonlar, sayfa geçişleri ve paylaşılan bileşen (layout) animasyonları için bu kütüphane tercih edilmektedir.

*   **Bileşen:** `MotionWrappers.tsx` (Yeniden kullanılabilir animasyon sarmalayıcıları)
*   **Staggered Entrance (Kademeli Giriş):** Sayfa açılışında kartların (`ThesisCard`, `AgentCard`, `FeatureCard`) topluca ekranda belirmesi yerine, aşağıdan yukarıya doğru hafif bir gecikmeyle (stagger) süzülerek gelmesi sağlanır. Bunun için `StaggerContainer` ve `StaggerItem` bileşenleri kullanılır.
*   **Hover Animasyonları:** Kartların üzerine gelindiğinde aniden büyümesi yerine, yay (spring) benzeri pürüzsüz bir efektle hafifçe büyümesi (`scale: 1.02`) için `HoverCard` kullanılır.
*   **Sayfa Geçişleri (Page Transition):** Rota değişimlerinde keskin bir atlama yerine, eski sayfanın kaybolup yeni sayfanın belirmesi `PageTransition` bileşeniyle sağlanır.
*   **Bildirim Panelleri (Dropdown Reveal):** Panellerin (`NotificationPanel.tsx` vb.) aniden açılmasını engellemek için, `DropdownReveal` kullanılarak yukarıdan aşağıya (ölçekleme ve saydamlık değişimi ile birlikte) pürüzsüzce açılıp kapanması sağlanır.
*   **Sidebar Aktif İndikatörü:** Sol menüde aktif sayfa değiştiğinde renklerin keskin değişmesi yerine, mavi göstergenin (`layoutId="sidebar-active-indicator"`) önceki aktif öğeden yeni aktif öğeye fiziksel olarak kayması sağlanmıştır.
