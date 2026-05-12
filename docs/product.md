# Ürün — ThesisForge

> Ürün vizyonu, problem tanımı, persona'lar, değer önerisi ve rakip konumlama. Bu dosya **"ne yapıyoruz, kim için yapıyoruz, niye"** sorularının tek truth file'ıdır.
>
> İlgili: [`architecture.md`](architecture.md) (nasıl yapıyoruz) · [`agents.md`](agents.md) (komite süreci) · [`demo.md`](demo.md) (sunum senaryoları)

---

## 1. Tek Cümle

> **ThesisForge:** *"Profesyonel yatırım komitesinin tartışma sürecini her bireysel yatırımcının cebine taşıyan AI sistemi."*

ThesisForge bir "borsa botu" ya da tahmin makinesi **değildir**; **karar destek sistemidir**. Kullanıcının kararı yerine geçmez, kararı daha iyi vermesini sağlar. Sistemin farkı çıktının kendisinden çok **çıktıyı üreten süreçtir**: birden fazla "analist ajan" aynı hisseye farklı açılardan bakar, biri devil's advocate olarak tezi sorgular, sentezleyici son kararı bull/bear/catalyst yapısında derler.

---

## 2. Çözülen Problem

**Türkiye retail yatırımcı tablosu:**

- 6 milyondan fazla bireysel yatırım hesabı
- Çoğu son 4-5 yılda açıldı (enflasyondan kaçış + döviz kontrolleri)
- Sonuç: piyasaya yeni gelmiş, deneyimsiz, ama parası olan büyük bir kitle

Bu kitle bir hisseyi araştırırken aşağıdakilerden birini yapar — ve hepsinin ciddi açıkları vardır:

| Yöntem | Sorun |
|---|---|
| Sosyal medya / Telegram grupları | Pump-dump çetelerinin yemi olur, manipülasyona açık |
| YouTube "borsa hocaları" | Çoğu sponsorlu, çıkar çatışması, gecikmiş bilgi |
| Tek bir aracı kurum raporu | Tek perspektif, kurumun pozisyonuna göre eğimli |
| Kendi araştırması | KAP'ı okumayı bilmiyor, finansal tabloyu anlayamıyor, haber + sentiment + teknik birleştiremiyor |
| Robo-advisor | Türkiye'de yok denecek kadar az; varsa portföy önerir, **tez üretmez** |

**Asıl sorun:** Bir hisse hakkında **çok-perspektifli, dengeli, kaynaklı** bir görüş üretmek profesyonel yatırım komitelerinin işidir — birden çok analist farklı açılardan bakar, bir risk yöneticisi karşı çıkar, bir başkan sentez yapar. Bu süreç retail yatırımcıya hiçbir ürün tarafından sunulmuyor.

**ThesisForge'un savunulabilir farkı:** Çıktıyı değil, **çıktıyı üreten komite sürecini** modeller.

---

## 3. Ne Olduğu / Ne Olmadığı

| ThesisForge **DEĞİLDİR** | ThesisForge **AYNEN BUDUR** |
|---|---|
| Bot — kullanıcı yerine işlem yapmaz | **Karar destek sistemi** — kararı kullanıcı verir |
| Tahmin makinesi ("ASELS yarın 75 TL olur") | **Tez üretici** ("Şu varsayımlar tutarsa yön yukarı") |
| Garanti vaad eden sistem | Belirsizliği **explicit hesaplayan**, güven aralığı veren |
| Tek doğru cevap üretir | **Bull case + Bear case + Anahtar katalizörler** üretir |
| Black box | **Her cümlenin kaynağı görünür** (cite-able) |
| HFT / intraday tahmin aracı | **Swing-trade ve uzun vadeli yatırım** aracı |
| Yatırım danışmanlığı (SPK lisansı gerektirir) | **Bilgi sunumu ve eğitim aracı** (lisans dışı) |

---

## 4. Personalar

### 4.1 Mehmet — 34, Mühendis — *"Hobby Investor"*

- BİST'te 6 yıl, 7 hisselik portföy. Maaşının %20'sini yatırıma ayırıyor.
- Haftada 1–2 saati araştırmaya ayırabiliyor.
- **Sorun:** Bilgi fazla, sentez zor. *"Hangisi gerçekten önemli?"*
- **Değer:** Watchlist'inin tezini haftalık 10 dakikada güncelleyip karar moduna geçer.
- **Demo senaryosu:** [`demo.md`](demo.md) Senaryo 1.

### 4.2 Zeynep — 27, Finans Öğrencisi / Junior Analyst — *"Aspiring Pro"*

- CFA Level 1 hazırlanıyor. KAP'ı okumayı biliyor ama zaman sıkıntısı.
- **Sorun:** Verim. Profesyonel iş akışını taklit etmek istiyor.
- **Değer:** Kendi tezini yazmadan önce "AI komite ne demiş" diye bakar, kör noktalarını yakalar.

### 4.3 Ali Bey — 56, Emekli Devlet Memuru — *"Conservative Saver"*

- Emeklilik birikimini değerlendirmek istiyor. Temettü hisselerine ilgili (BIMAS, AKBNK, EREGL).
- Teknik analizi anlamıyor ve istemiyor — temel hikaye yeterli.
- **Sorun:** Yanlış hisseye girip sermayeyi yakma korkusu.
- **Değer:** **Conservative mode** — bear case ağırlıklı, temettü güvenliği vurgulanır. Davranış kuralları: [`agents.md`](agents.md) §6.
- **Demo senaryosu:** [`demo.md`](demo.md) Senaryo 2.

### 4.4 Sekonder — Junior PM / Analyst (Kurumsal)

Hackathon hedef kitlesi değil, B2B genişlemesi için kritik. Aracı kurumlarda junior analistler ThesisForge'u brifing aracı olarak kullanabilir (sabah toplantısı özeti). Roadmap detayı: [`roadmap.md`](roadmap.md).

---

## 5. Değer Önerisi ve Regülasyon Konumlandırması

ThesisForge **bilgi sunumu ve eğitim aracı** konumlanır, **yatırım danışmanlığı değildir** (SPK lisansı dışı). Bu konumlandırma:

1. **Regülasyon riskini azaltır.** SPK'nın "yatırım danışmanlığı" tanımına girmemek için "tez üretici" olarak konumlanır, "öneri yapıcı" olarak değil.
2. **Judge psikolojisi açısından akıllıdır.** "AI insan yerine karar verir" korkusu sunum ilk 60 saniyesinde söndürülür.
3. **Her tezde zorunlu disclaimer** bulunur: *"Bu içerik bilgi amaçlıdır, yatırım tavsiyesi değildir. Yatırım kararları için lisanslı bir danışmana başvurun."*

---

## 6. Rakip Konumlama

| Rakip Tipi | Ne Yapıyor | ThesisForge Farkı |
|---|---|---|
| Sosyal medya / Telegram | Manipülasyona açık tek-sesli yorumlar | Çok-perspektifli + kaynaklı |
| YouTube borsa hocaları | Sponsorlu, gecikmiş | Real-time, çıkar çatışmasız |
| Aracı kurum raporları | Tek perspektif, kurumsal eğimli | Bağımsız komite, devil's advocate |
| Robo-advisor (yurt dışı) | Portföy önerir, **tez üretmez** | Tez üretici, eğitici |
| Generic AI chatbot (ChatGPT vb.) | Halüsinasyona açık, kaynaksız | **Citation-grounded** + Türkiye-spesifik veri |

**Diferansiyatör 3'lü kombinasyon:**
1. Multi-agent komite süreci ([`agents.md`](agents.md))
2. Her sayının kaynağına bağlı citation ([`agents.md`](agents.md) §5)
3. Geçmiş tezleri hatırlayan memory ajanı ([`agents.md`](agents.md) §1.8 + [`flows.md`](flows.md) §4)

Bu kombinasyon piyasada yok.
