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

## 4. Mikro-Animasyonlar ve Bildirimler

Kullanıcıyı sistemin "canlı" ve "işlemde" olduğuna inandıran en önemli detaylar:

*   **Fiyat Flaşları:** Piyasadan gelen anlık değişimleri (veya WebSocket verilerini) simüle etmek/göstermek için kullanılır. Fiyat arttığında widget arkaplanı kısa bir süreliğine (400ms) **Boğa Rengi (`#089981/20`)**, düştüğünde **Ayı Rengi (`#f23645/20`)** olarak parlar. 
*   **İskelet Yükleyiciler (Skeleton Loaders):** LLM (Yapay Zeka) 50 saniyelik bir analiz yaparken ekran boş kalmaz. Kullanıcıyı bilgilendiren ve profesyonel görünen `ThesisSkeleton.tsx` bileşeni gösterilir. Üzerindeki *pulse (nabız)* animasyonları arka planda veri okunduğu hissiyatını verir.
*   **Lucide İkonları:** Tüm ikonlar `lucide-react` üzerinden sağlanır. Tasarımda tutarlılık ve aynı çizgi kalınlığının (stroke-width) korunması hedeflenir.

## 5. Scrollspy (Aktif Navigasyon İzleme)

Anasayfada kullanıcı deneyimini artırmak için statik menüler yerine sayfa kaydırmasını (scroll) izleyen dinamik bir Header (üst menü) yapısı kullanılmıştır.

*   **Bileşen:** `MarketingHeader.tsx` (Client Component)
*   **Mekanizma:** `IntersectionObserver` API'si kullanılarak kullanıcının ekranda hangi bölümü (`#urun`, `#ajanlar`, `#nasil-calisir`, `#kaynaklar`) görüntülediği tespit edilir.
*   **Görsel Geri Bildirim:** Aktif olan (ekranda görünen) bölümün menüdeki linki parlak (`bg-white/10 text-white`) hale gelirken, diğer linkler sönük (`text-text-2`) kalarak kullanıcının nerede olduğunu anlaması sağlanır.

---

*Not: Bu yönergeler `MarketPulse.tsx`, `ThesisSkeleton.tsx` ve `MarketingHeader.tsx` bileşenleri üzerinde başarıyla uygulanmıştır. Projeye eklenecek yeni görselleştirme widget'larında da bu standartlara uyulmalıdır.*

## 6. Dinamik Breadcrumb (Navigasyon Hiyerarşisi)

Borsa terminallerindeki derin sayfa hiyerarşilerinde (örneğin: `Dashboard > İzleme Listesi > Bankacılık > AKBNK`) kullanıcının kaybolmasını engellemek için dinamik bir **Breadcrumb** yapısı kullanılmıştır.

*   **Bileşen:** `Breadcrumbs.tsx`
*   **Mekanizma:** Next.js `usePathname` kancasıyla (hook) mevcut URL parçalanır ve `LABELS` sözlüğü aracılığıyla okunabilir Türkçe başlıklara (Örn: `Uygulama > Tezler > Canlı Komite`) dönüştürülür.
*   **Kullanıcı Deneyimi:** Kullanıcının üst sayfalara tek tıklamayla dönmesini sağlayarak gezinme hızını artırır ve sisteme "web sitesinden" ziyade "profesyonel masaüstü terminali" ağırlığı kazandırır.

## 7. Framer Motion ile Mikro-Animasyonlar

Projenin canlı ve modern bir his vermesi için sayfa içi animasyonlarda **Framer Motion** kullanılmıştır. CSS transition'larının yetersiz kaldığı durumlarda, orkestre edilmiş (staggered) animasyonlar, sayfa geçişleri ve paylaşılan bileşen (layout) animasyonları için bu kütüphane tercih edilmektedir.

*   **Bileşen:** `MotionWrappers.tsx` (Yeniden kullanılabilir animasyon sarmalayıcıları)
*   **Staggered Entrance (Kademeli Giriş):** Sayfa açılışında kartların (`ThesisCard`, `AgentCard`, `FeatureCard`) topluca ekranda belirmesi yerine, aşağıdan yukarıya doğru hafif bir gecikmeyle (stagger) süzülerek gelmesi sağlanır. Bunun için `StaggerContainer` ve `StaggerItem` bileşenleri kullanılır.
*   **Hover Animasyonları:** Kartların üzerine gelindiğinde aniden büyümesi yerine, yay (spring) benzeri pürüzsüz bir efektle hafifçe büyümesi (`scale: 1.02`) için `HoverCard` kullanılır.
*   **Sayfa Geçişleri (Page Transition):** Rota değişimlerinde keskin bir atlama yerine, eski sayfanın kaybolup yeni sayfanın belirmesi `PageTransition` bileşeniyle sağlanır.
*   **Bildirim Panelleri (Dropdown Reveal):** Panellerin (`NotificationPanel.tsx` vb.) aniden açılmasını engellemek için, `DropdownReveal` kullanılarak yukarıdan aşağıya (ölçekleme ve saydamlık değişimi ile birlikte) pürüzsüzce açılıp kapanması sağlanır.
*   **Sidebar Aktif İndikatörü:** Sol menüde aktif sayfa değiştiğinde renklerin keskin değişmesi yerine, mavi göstergenin (`layoutId="sidebar-active-indicator"`) önceki aktif öğeden yeni aktif öğeye fiziksel olarak kayması sağlanmıştır.

## 8. Kademeli Bilgi Gösterimi (Progressive Disclosure)

Çoklu yapay zeka (Multi-Agent) mimarisinde, 8 farklı ajanın aynı anda ekrana metin basması (typewriter efekti) bilişsel yük (cognitive overload) yaratır. Bunu engellemek için **AgentCard** bileşeninde "Hibrit UX" modeline geçilmiştir:

*   **Bekleme ve Yüklenme (Idle/Running):** Ajanlar çalışırken ekrana uzun metinler basılmaz. Bunun yerine "Sırasını bekliyor..." veya pürüzsüz dolan bir İlerleme Çubuğu (Progress Bar) ile "Veriler sentezleniyor..." animasyonu gösterilir.
*   **Özet Görünüm (Done):** Analiz tamamlandığında, kutu ajanın kendi tematik rengine (Örn: Boğa için yeşil) bürünür ve metnin sadece ilk 2 satırı (hap bilgi) gösterilir.
*   **Genişletilebilir Detay (Expand):** Kullanıcı sadece merak ettiği ajanın (Örn: Teknik Analist) detaylarını okumak isterse, kutuya veya "Detaylı Analizi Oku" butonuna tıklayarak metnin tamamını temiz bir konsol görünümünde açabilir. Bu sayede ekran yorucu bir metin yığını olmaktan çıkar.

## 9. Midas Stili Gezinme ve Pazarlama UX'i (Scroll Snapping & Scroll-to-Top)

Modern FinTech uygulamalarının (özellikle getmidas.com gibi platformların) akıcı pazarlama sayfası deneyimini projeye taşımak amacıyla, anasayfa üzerinde özel kaydırma davranışları uygulanmıştır:

*   **Boyut Atlama Hissi (CSS Scroll Snapping):** Kullanıcı fare tekerleğini kaydırdığında sayfanın bölümler arasında yarım kalmasını önlemek için `globals.css` içinde `scroll-snap-type: y proximity` ve her bir section için `.snap-section` (başlangıca hizalama) sınıfı kullanılmıştır. Bu sayede bölümler (Örn: Özellikler, Nasıl Çalışır) ekrana adeta mıknatıs gibi pürüzsüzce oturur.
*   **Akıllı Yukarı Çık Butonu (ScrollToTop):** Kullanıcı uzun sayfayı incelerken kaybolmasın diye `ScrollToTop.tsx` bileşeni eklenmiştir. Yalnızca belirli bir mesafe (`scrollY > 500`) kaydırıldığında zarafetle ekranda belirir (fade-in & translate) ve tıklatıldığında "smooth scroll" animasyonu ile en tepeye döner.

## 10. İkna ve Sosyal Kanıt Elementleri (Landing Page Eklentileri)

Bir projenin jüriye veya yatırımcıya "kullanıma hazır bir ürün" (Production-ready) gibi hissettirmesi için eksik olan kritik pazarlama bileşenleri eklenmiştir:

*   **TrustedBy (Sosyal Kanıt):** Kullanıcı siteye girer girmez *Borsa İstanbul, KAP, TCMB, Gemini* gibi güvenilir otorite logolarını görür. Sönük ve gri (grayscale) tonlarda tasarlanarak ana tasarımı boğmadan "kurumsal altyapı" mesajı verir.
*   **Personas (Kimler İçin Tasarlandı):** Ürünün sadece ne yaptığı değil, *kimin hangi problemini çözdüğü* vurgulanır. Bireysel Yatırımcılar, Fon Yöneticileri ve İçerik Üreticileri için 3 ayrı kullanım senaryosu (Use-case) sunulur.
*   **FAQ (Sıkça Sorulan Sorular):** Kullanıcıların yapay zeka ve finans hakkındaki haklı şüphelerini gidermek için eklendi. Ağır kütüphaneler yerine saf HTML5 `<details>` ve `<summary>` etiketleri ile son derece hafif ve modern bir akordeon (Accordion) yapısı kurulmuştur.
