# ThesisForge — PLAN.md Maddeleri için Implementasyon Planı

## Context

PLAN.md'de kullanıcı, hackathon teslimine 6 gün kala (2026-05-24 teslim) projede yapılmasını istediği 17 ana madde + alt maddeyi listeledi. Bunlar üç kategoride:

1. **Bug fix'ler** — tez üretimi sırasında progress bar'ın direkt %90'a sıçraması, "kaynak 0" hatası, bull/bear/catalyst kaynak linklerinin görünmemesi, PDF üretilmemesi, link açılamayan kaynakların tool-call jargonuyla görünmesi.
2. **Yeni özellikler** — üye olma/giriş, tüm şirketleri listeleyen sayfa, mobil uyumluluk, ilk-giriş onboarding pop-up'ları, watchlist sembol doğrulaması, geçmiş tezlerde pagination, grafiklerde yıllık periyot.
3. **UX iyileştirmeleri** — terminolojinin (Şeytan Avukatı → Anti-tez Uzmanı) sadeleştirilmesi, profil/ayarlar sayfalarının kullanılabilir hale getirilmesi, navbar'ın yatırım disclaimer'larıyla doldurulması, kaynak metinlerinin teknik jargondan arındırılması.

Hedef: tüm maddeleri öncelik (P0→P3) sırasına dizip, kullanıcının sırayla uygulayabileceği executable bir plan vermek. Karar: NextAuth.js + kendi DB, sentiment "bull-bear net skor + güven skoru kombinasyonundan türet", Şeytan Avukatı yalnızca UI'da "Anti-tez Uzmanı" olur (backend `devils_advocate` ID değişmez).

---

## Öncelik Özeti

| Tier | Konu | Tahmini süre |
|---|---|---|
| **P0** (kritik bug) | Progress bar %90 sıçraması, kaynak 0, kaynak link görünmemesi, PDF, link açılmayan kaynakların temizlenmesi, donmuş hissi | ~1.5 gün |
| **P1** (zorunlu UX) | Auth (NextAuth+DB), mobil uyumluluk, Şeytan Avukatı→Anti-tez Uzmanı, watchlist validation, geçmişe pagination, "Tezler" rename, yeni tez placeholder, sağ kutu kaldır, header bildirim kaldır | ~2 gün |
| **P2** (yeni sayfalar) | Tüm şirketler sayfası, profil/ayarlar revizyonu, navbar disclaimer/legal, onboarding pop-up, candlestick toggle, sentiment etiketleme & açıklama, alt mobil menü bar | ~1.5 gün |
| **P3** (nice-to-have) | Squad CSV config, grafik 1Y periyodu, news/KAP tab ayrımı tez sayfasında | ~1 gün |

---

## P0 — Kritik Bug Fix'ler

### 1. Progress bar %90'a sıçrama + donmuş hissi
- **Kök neden**: `backend/app/agents/orchestrator.py` sadece `agent_start` / `stage` / `token` event'i yayıyor; ara yüzde % bilgisi yok. Frontend `src/lib/adapters/StreamAdapter.ts` ve `LiveThesisRunner.tsx` yüzdeyi `(finishedAgents + runningAgents*0.45)/AGENT_COUNT` formülüyle hesaplıyor → ilk agent başlayınca direkt %45/8 değil 7×0.45 etkisi tetiklenip büyük sıçrama oluyor.
- **Fix (backend)**: `orchestrator.py`'de her ajan içine `agent_progress` event'i ekle — tool çağrısı başında/bitiminde 0-100 arası "agent içi" yüzde gönder. Yeni event tipi `ws_hub.publish(thesis_id, {"type": "agent_progress", "agent": "<id>", "pct": <0..100>})`.
- **Fix (frontend)**: `src/lib/types/backend.ts` ve `StreamAdapter.ts`'e `agent_progress` çevirisi ekle. `LiveThesisRunner.tsx` AgentCard'da bireysel bar göster; toplam yüzdeyi ajan-içi yüzdelerin ortalaması olarak hesapla.
- **Donmuş hissi**: `AgentCard`'a aktif "düşünüyor" animasyonu (pulsing dot + her 2sn değişen status mesajı — "Veri çekiliyor…", "Analiz ediyor…", "Yazıyor…") ekle. Token akışı dururken bile shimmer/loader aktif kalsın.
- **Dosyalar**: `backend/app/agents/orchestrator.py`, `backend/app/agents/{technical,fundamental,macro_context,devils_advocate}_*.py`, `backend/app/api/ws_hub.py`, `frontend/src/lib/types/backend.ts`, `frontend/src/lib/adapters/StreamAdapter.ts`, `frontend/src/components/app/LiveThesisRunner.tsx`.

### 2. "Kaynak 0" hatası
- **Kök neden**: `backend/app/agents/tools.py:86` — tool exception path'inde `insert_tool_call_log` çağrısı atlanıyor; ayrıca `confidence.py` EXPECTED_TOOL_TOTAL=18 sayısı bazı squad'larda gerçekçi değil. Frontend bazen `citations` endpoint'i boş dönerse "0 kaynak" gösteriyor.
- **Fix**:
  - `tools.py` exception handler'ında **başarısız bile olsa** placeholder tool_call_log yazılsın (status: "failed", error_msg).
  - `synthesizer.py:_drop_weak_unsourced_bullets` çağrısından önce, gerçek `call_id` sayısını logla ve `ws_hub.publish({"type":"info","msg":f"{n} kaynak toplandı"})`.
  - Frontend `ThesisReport.tsx`/sources panelinde count'u `theses.tool_call_logs` (başarılı olan) üzerinden çek; 0 ise empty-state "kaynak yükleniyor / kaynak eşleştiriliyor" göster, hata olarak gösterme.
- **Dosyalar**: `backend/app/agents/tools.py`, `backend/app/agents/synthesizer.py`, `backend/app/agents/confidence.py`, `frontend/src/components/shared/ThesisReport.tsx`, `frontend/src/components/app/SourceChip*.tsx`.

### 3. Bull/Bear/Catalyst kaynak linkleri görünmüyor
- **Kök neden**: `BullBearPoint.call_id` synthesizer'da düşüyor olabilir veya frontend markdown render'ında `[kaynak: UUID]` parse'ı kırık. `synthesizer.py:_repair_missing_bullet_citations` keyword eşleştirmesi çok kısıtlı.
- **Fix**:
  - `extract_structured()` regex'ini (synthesizer.py ~504) genişlet; her bullet için call_id zorunlu, eksikse en yakın `tool_call_log` ile heuristik eşleştir (timestamp + agent_id).
  - Frontend'de `SourceChipPopover.tsx`'i bull/bear/catalyst list'lerinin her satırının yanına render et (şu an sadece markdown gövdede render ediliyor olabilir).
  - `/api/thesis/{id}/citations` cevabına `url`, `source_label` (örn. "KAP Bildirimi - 14.05.2026") alanlarını ekle.
- **Dosyalar**: `backend/app/agents/synthesizer.py`, `backend/app/api/thesis.py` (citations endpoint), `frontend/src/components/app/SourceChipPopover.tsx`, `frontend/src/components/shared/ThesisReport.tsx`.

### 4. PDF üretilmiyor
- **Kök neden**: `frontend/src/components/app/ThesisExportButtons.tsx` `window.print()` çağırıyor; bazı tarayıcılarda print sheet stil dosyası yüklenmeden tetikleniyor veya pop-up blocker engelliyor.
- **Fix**: Browser-native print yerine **server-side PDF** üretimi:
  - Backend'e `weasyprint` (Python) ekle. Yeni endpoint: `GET /api/thesis/{id}/pdf` → markdown'ı HTML'e (markdown-it), HTML'i PDF'e (weasyprint) çevir, `Content-Disposition: attachment` ile dön.
  - Frontend `ThesisExportButtons.tsx`'de PDF butonu doğrudan bu URL'i `window.open` etsin.
- **Dosyalar**: `backend/requirements.txt`, `backend/app/api/thesis.py` (yeni pdf endpoint), `backend/app/pdf/render.py` (yeni), `frontend/src/components/app/ThesisExportButtons.tsx`.

### 5. Link açılmayan kaynakları temizle + yatırımcı diliyle yaz
- **Kök neden**: Tool call'lar bazen `{"source":"yfinance","tool":"get_ohlcv"}` gibi teknik label dönüyor; frontend bunu olduğu gibi gösteriyor.
- **Fix**:
  - `backend/app/citations/validator.py` içine `is_user_facing(call_log) -> bool` ekle: URL'i `httpx.head()` ile 2sn timeout doğrula; başarısızsa `user_facing=False` flag'le.
  - `frontend/src/lib/data/tool-labels.ts` zaten var; her tool_name için **Türkçe yatırımcı dili** karşılık eklensin (örn. `get_ohlcv` → "Fiyat geçmişi", `kap_disclosures` → "KAP bildirimi"). `SourceChip.tsx` ham tool adı yerine bu label'ı göstersin.
  - `user_facing=False` olan kaynaklar listeden gizlensin (sadece debug panelinde kalsın).
- **Dosyalar**: `backend/app/citations/validator.py`, `frontend/src/lib/data/tool-labels.ts`, `frontend/src/components/app/SourceChip.tsx`, `frontend/src/components/app/SourceChipPopover.tsx`.

---

## P1 — Zorunlu UX

### 6. Auth: NextAuth.js + DB (email/şifre + Google opsiyonel)
- **Backend**:
  - `backend/app/db/models.py` `users` tablosuna: `email UNIQUE NOT NULL`, `password_hash`, `name`, `created_at` kolonları ekle (alembic migration).
  - Yeni endpoint dosyası `backend/app/api/auth.py`: `POST /auth/register`, `POST /auth/login` (bcrypt + JWT), `GET /auth/me`.
  - `backend/app/api/watchlist.py` ve `theses` endpoint'lerinde `user_id` artık demo UUID yerine JWT'den çekilsin (FastAPI dependency `get_current_user`).
- **Frontend**:
  - `next-auth` paketi + `CredentialsProvider` (backend `/auth/login`'a proxy). `pages/api/auth/[...nextauth].ts` veya App Router için `app/api/auth/[...nextauth]/route.ts`.
  - Yeni sayfalar: `/app/(auth)/login/page.tsx`, `/app/(auth)/register/page.tsx`.
  - `(app)/layout.tsx` `getServerSession` ile login değilse `/login`'e redirect.
  - `src/lib/api/*` client'larında `session.accessToken` header'a eklensin.
  - `localStorage.thesisforge.demo_user_id` fallback'i geliştirici modunda kalsın, prod'da kaldır.
- **Dosyalar**: yukarıda + `backend/alembic/versions/`, `frontend/package.json`.

### 7. Mobil uyumluluk (`!!!`)
- Mevcut Tailwind breakpoint kullanımı kısmen var ama `LiveThesisRunner` (1437 satır) ve `ThesisReport` masaüstü-öncelikli.
- **Fix**:
  - `Sidebar` mobilde gizlensin, yerine **alt mobil tab bar** (madde 11) görünsün.
  - `Topbar`: search + user menu mobilde hamburger arkasına alınsın.
  - `LiveThesisRunner` assembly animasyonunu mobilde basitleştir (komite sahnesi yerine kompakt liste).
  - `PriceChartCard`, `MarketPulse` ECharts component'lerinde `ResizeObserver` doğru çalıştığından emin ol.
  - Tüm `grid-cols-3` ve `flex` yapıları `flex-wrap` + `min-w-0` ile responsive olsun.
  - Test: Chrome DevTools 375px, 768px, 1024px breakpoint'lerinde her sayfa.
- **Dosyalar**: `frontend/src/components/shell/*`, `frontend/src/components/app/LiveThesisRunner.tsx`, `frontend/src/components/shared/ThesisReport.tsx`, `frontend/src/app/(app)/**/page.tsx`.

### 8. "Şeytan Avukatı" → "Anti-tez Uzmanı" (sadece UI)
- Backend ID `devils_advocate` aynen kalır. Yalnız UI string'leri:
  - `frontend/src/lib/mock/agents.ts` → name değiştir.
  - `frontend/src/lib/data/squad-labels.ts` (varsa) + `agent-labels.ts` → güncelle.
  - `frontend/src/components/marketing/AgentShowcase.tsx`, `FAQ.tsx`, `SettingsPanels.tsx`, `ThesisReport.tsx` içindeki tüm string occurrences.
  - Grep komutu: `rg -i "şeytan avukat|devils?.advocate" frontend/src` (sadece display string'leri değiştir, ID/key'lere dokunma).

### 9. Watchlist sembol doğrulaması
- **Backend**: `backend/app/api/watchlist.py` POST handler'ında `CompanyLookupProvider.fetch(ticker)` çağır → bulunamazsa `HTTPException(404, "Bu sembol BIST'te bulunmuyor")`.
- **Frontend**: `WatchlistPage` add modal'ında 404 response'unu toast olarak göster, watchlist'e eklenmesin.
- **Dosyalar**: `backend/app/api/watchlist.py`, `frontend/src/app/(app)/app/watchlist/page.tsx`.

### 10. "Geçmiş Tezler" → "Tezler" + pagination
- Sayfa adı + sidebar link: `frontend/src/components/shell/Sidebar.tsx` ve `frontend/src/app/(app)/app/history/page.tsx` başlığı "Tezler".
- Pagination:
  - Backend: `GET /api/theses?limit=10&offset=0` zaten limit destekliyor (orchestrator analizinden), offset/total ekle.
  - Frontend: shadcn `Pagination` component'i, 10'arlı sayfa, total count'tan sayfa sayısı.
- **Dosyalar**: `backend/app/api/thesis.py` (list endpoint), `frontend/src/app/(app)/app/history/page.tsx`.

### 11. Yeni tez ekranında sağ kutuyu kaldır + placeholder boş
- `LiveThesisRunner.tsx`'de `idle` state'te şu an muhtemelen sağda live progress sidebar var. Hero idle state'te sadece form göster (tek kolon, max-w-2xl center).
- Symbol ve persona input'ları **boş** başlasın (mevcut autofill/default kaldır).
- **Dosya**: `frontend/src/components/app/LiveThesisRunner.tsx`.

### 12. Header bildirim butonunu kaldır
- `frontend/src/components/shell/Topbar.tsx` içinden `<NotificationPanel />` import + render satırlarını sil. (Backend tarafı yok, sade FE silme.)

---

## P2 — Yeni Sayfalar / İçerik

### 13. Tüm şirketler sayfası (`/app/companies`)
- Veri kaynağı: `mkk_companies.csv` (~893 ticker). `CompaniesProvider` zaten okuyor; yeni endpoint `GET /api/companies?search=&limit=&offset=` → ticker, name, sector döner.
- UI: arama çubuğu + responsive kart grid (her kartta: ticker, isim, sektör badge, "Tez Üret" + "Watchlist'e Ekle" butonları).
- Sayfa: `frontend/src/app/(app)/app/companies/page.tsx`.
- Sidebar'a "Şirketler" linki ekle.
- **Dosyalar**: `backend/app/api/companies.py` (yeni), `frontend/src/app/(app)/app/companies/page.tsx` (yeni), `frontend/src/components/app/CompanyCard.tsx` (yeni), `frontend/src/components/shell/Sidebar.tsx`.

### 14. Mum + normal grafik (toggle)
- `PriceChartCard.tsx` şu an Recharts area chart. Candlestick için: lightweight-charts (TradingView) veya ECharts kullan; ECharts zaten var → ECharts ile candlestick.
- Toggle: "Çizgi / Mum" tab grup, period seçicinin yanında.
- Backend `/api/market/history/{ticker}` zaten OHLCV döndürüyor.
- **Dosya**: `frontend/src/components/app/PriceChartCard.tsx`.

### 15. Profil + Ayarlar sayfaları kullanılabilir hale gelsin
- Profil sayfası (`/app/profile`) yeni: kullanıcı adı, email, parola değiştir (NextAuth ile), watchlist sayısı, üretilen tez sayısı.
- Ayarlar: `SettingsPanels.tsx`'de **kullanılmayan/mock kısımları kaldır** (DataSources panel'i hardcoded mock'sa sil; Dev options panel'i prod'da gizle). Kalan: tema (light/dark), bildirim tercihleri (gelecek için placeholder), hesap silme.
- **Dosyalar**: `frontend/src/app/(app)/app/profile/page.tsx` (yeni), `frontend/src/app/(app)/app/settings/page.tsx`, `frontend/src/components/app/SettingsPanels.tsx`.

### 16. Navbar düzenleme + yatırım disclaimer/legal
- Marketing navbar (`frontend/src/components/marketing/Navbar.tsx`) + footer: "Yasal Uyarı", "Risk Bildirimi", "Gizlilik", "Kullanım Şartları" sayfaları.
- Yeni statik sayfalar: `frontend/src/app/(marketing)/legal/{disclaimer,risk,privacy,terms}/page.tsx`.
- İçerik: **SPK lisans dışı, yatırım tavsiyesi değildir** vurgusu (BLUEPRINT.md product konsepti).

### 17. İlk-giriş onboarding pop-up'ları
- Yeni component: `frontend/src/components/app/OnboardingTour.tsx`.
- Library: `react-joyride` veya kendi adımlı modal (5 adım: Dashboard → Tezler → Yeni Tez → Watchlist → Profil).
- Trigger: `localStorage.thesisforge.onboarding_done` yoksa ilk login'de açıl. Skip + "Bir daha gösterme" butonu.
- Profil sayfasında "Turu yeniden başlat" butonu.

### 18. Tez sayfasında haber/KAP tab ayrımı
- `frontend/src/components/app/CompanyFeed.tsx` şu an karma gösteriyor. Tab grubu ekle: "Tümü" / "Haberler" / "KAP Bildirimleri". `kind` alanına göre filtrele.
- **Dosya**: `frontend/src/components/app/CompanyFeed.tsx`.

### 19. Mobil alt menü bar (madde 4 "son menü bar")
- Component: `frontend/src/components/shell/MobileTabBar.tsx`.
- 4-5 ikon: Anasayfa, Tezler, Yeni Tez (+), Watchlist, Profil.
- Sadece `<md` ekran boyutunda görünsün (`md:hidden`).
- `(app)/layout.tsx`'e ekle.

### 20. Sentiment etiket + güven skoru açıklaması
- **Backend**: `synthesizer.py` veya yeni `backend/app/agents/sentiment_label.py`:
  ```
  net = sum(bull.score) - sum(bear.score)
  if net >= 6:  label = "POZITIF"
  elif net <= -6: label = "NEGATIF"
  else: label = "NÖTR"
  ```
  `ThesisOutput` şemasına `sentiment_label` ekle (migration: `theses.sentiment_label TEXT`).
- **Frontend**: Tez detayında badge (yeşil/kırmızı/gri) + tooltip: "POZITIF: Boğa argümanları ağır basıyor. Güven skoru bu argümanların ne kadar sağlam veriye dayandığını gösterir; iki ölçü birbirinden bağımsızdır."
- **Dosyalar**: `backend/app/agents/synthesizer.py`, `backend/app/db/models.py`, alembic migration, `frontend/src/components/shared/ThesisReport.tsx`, `frontend/src/lib/types/backend.ts`.

---

## P3 — Nice-to-have

### 21. Squad CSV config (madde 28)
- Şu an `orchestrator.py`'de hardcoded 17+1 sektör. CSV-driven hale getir:
  - Yeni dosya: `backend/app/agents/squads.csv` (kolonlar: `sector, name_tr, lead_agent, extra_tools, persona_hint`).
  - Yeni loader: `backend/app/agents/squad_loader.py` (`load_squads() -> dict[str, SquadConfig]`).
  - `sector_router.py` ve `orchestrator.py` bu config'ten çeksin.
- Risk: 6 günde stabil oturmayabilir; P3 olarak sona at, vakit kalırsa.

### 22. Grafiklerde yıllık periyot (madde 38)
- Perf endişesi: yfinance 1Y daily = 252 mum, sorun değil. Redis cache (15dk) ekle.
- `backend/app/api/market.py` `/history/{ticker}?period=1Y` desteği + cache.
- `PriceChartCard` period seçiciye "1Y" ekle.

---

## Kritik Dosyalar (özet)

**Backend**:
- `backend/app/agents/orchestrator.py` — progress event'leri
- `backend/app/agents/synthesizer.py` — citation repair + sentiment label
- `backend/app/agents/tools.py` — fail-safe tool log
- `backend/app/citations/validator.py` — URL reachability
- `backend/app/api/auth.py` (yeni) — NextAuth backend
- `backend/app/api/companies.py` (yeni) — şirket listesi
- `backend/app/api/watchlist.py` — sembol doğrulama
- `backend/app/api/thesis.py` — pdf endpoint, pagination
- `backend/app/pdf/render.py` (yeni) — weasyprint
- `backend/app/db/models.py` + alembic migrations

**Frontend**:
- `frontend/src/components/app/LiveThesisRunner.tsx` — progress, idle, sağ kutu
- `frontend/src/components/app/PriceChartCard.tsx` — candlestick, 1Y
- `frontend/src/components/app/SourceChip{,Popover}.tsx` — temiz kaynak gösterimi
- `frontend/src/components/shared/ThesisReport.tsx` — sentiment badge, kaynak linkleri
- `frontend/src/components/shell/{Topbar,Sidebar,MobileTabBar}.tsx`
- `frontend/src/components/app/CompanyFeed.tsx` — haber/KAP tab
- `frontend/src/components/app/SettingsPanels.tsx` — sadeleştirme
- `frontend/src/app/(app)/app/{companies,profile,history,watchlist}/page.tsx`
- `frontend/src/app/(app)/(auth)/{login,register}/page.tsx` (yeni)
- `frontend/src/app/(marketing)/legal/**/page.tsx` (yeni)
- `frontend/src/lib/data/tool-labels.ts` — Türkçe yatırımcı dili
- `frontend/src/lib/mock/agents.ts` — Anti-tez Uzmanı rename

---

## Verification

Her tier bittiğinde:

**P0 doğrulama**:
1. `cd backend && uvicorn app.main:app` + `cd frontend && pnpm dev`.
2. ASELS veya TUPRS için tez başlat → progress bar pürüzsüz 0→100 ilerlesin, her ajan kendi % barıyla görünsün, donmuş hissi olmasın.
3. Tez bittiğinde bull/bear/catalyst kartlarının her satırında en az 1 kaynak chip'i olsun, tıklayınca anlamlı Türkçe label + URL açılsın.
4. PDF butonu → tarayıcıda yeni sekmede PDF açılsın (server-side).
5. Kaynaklar listesinde hiçbir "yfinance.get_ohlcv" gibi ham tool ismi olmasın.

**P1 doğrulama**:
1. `/register` → kayıt → `/login` → dashboard'a yönlensin, watchlist'i o kullanıcıya özel.
2. Chrome DevTools 375px'te tüm sayfalar bozulmadan açılsın, alt menü bar çalışsın.
3. Watchlist'e "ABCDEF" eklemeyi dene → toast: "Bu sembol BIST'te bulunmuyor".
4. "Tezler" sayfasında 10'arlı pagination çalışsın.
5. Tüm UI'da "Şeytan Avukatı" stringi grep'le sıfır sonuç versin, "Anti-tez Uzmanı" çıksın.

**P2 doğrulama**:
1. `/app/companies` → 893 şirket sayfa sayfa görünsün, arama + filtre çalışsın.
2. Grafikte mum/çizgi toggle, sentiment badge tooltip ile birlikte.
3. Onboarding ilk login'de açılsın, "Bir daha gösterme" sonrası açılmasın.

**P3 doğrulama**:
1. `squads.csv`'ye yeni sektör ekle → restart sonrası router yeni squad'ı route etsin.
2. Grafikte 1Y seçildiğinde response <2sn (cache hit'te <200ms).

---

## Notlar

- **Auth migration**: mevcut `users` tablosunda demo UUID kayıtları var; migration'da `email` nullable başlat, sonra zorunlu yap; mevcut watchlist/theses kayıtları korunsun.
- **Sentiment threshold (±6)**: Synthesizer çıktısının bull/bear distribütion'ı 2-3 tezde gözlemlenip eşik ince ayar yapılmalı. P2 son aşamasında calibration için bir Jupyter notebook ile 5-10 tez üzerinde dene.
- **Mobile test cihazı**: gerçek iPhone/Android'de Chrome ile test et; Safari'de Recharts/ECharts viewport bug'ları olabilir.
- **NextAuth + FastAPI**: JWT secret iki tarafta aynı `.env` değişkeninden okunsun (`NEXTAUTH_SECRET` = `JWT_SECRET`).
