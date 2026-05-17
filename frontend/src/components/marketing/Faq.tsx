import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Faq = {
  q: string;
  a: string;
};

const FAQS: Faq[] = [
  {
    q: "Yapay zekâ halüsinasyon (uydurma) yapıyor mu?",
    a: "Hayır. ThesisForge RAG (Retrieval-Augmented Generation) mimarisiyle çalışır. Sadece sistemde indekslenen KAP bildirimleri, çeyreklik raporlar, TCMB EVDS serileri ve MKK olay kayıtları üzerinden konuşur. Bilmediği konuda “kaynak bulunamadı” döner; tahmin etmez.",
  },
  {
    q: "Hangi verileri kullanıyorsunuz?",
    a: "Birincil 4 resmi kaynak: KAP (Kamuyu Aydınlatma Platformu), Borsa İstanbul (seans verisi + duyurular), TCMB EVDS (makro & faiz serileri) ve MKK (Merkezi Kayıt Kuruluşu olay verisi). Buna ek olarak ajanlar Türkçe haber akışından duygu (sentiment) skoru üretir.",
  },
  {
    q: "Veriler ne sıklıkla güncelleniyor?",
    a: "Bilanço ve KAP açıklamaları gün-içi push (yayınlandığı an), seans verisi T+1 batch, makro serileri TCMB yayın takvimine bağlı. Her tezin altında kullanılan kaynağın `tarih + sürüm` etiketi gösterilir (örn. `KAP-24Q3`).",
  },
  {
    q: "Kaç ajan var ve ne işe yarıyor?",
    a: "8 uzman ajan: Teknik Analist, Temel Analist, Şeytan Avukatı, Sentez, Bellek, Katalist Avcısı, Algı, Risk Yönetimi. Her ajanın net bir mandası ve kendi güven katkısı vardır; Sentez ajanı hepsini okuyup kalibre edilmiş bir tez üretir.",
  },
  {
    q: "Güven skoru (confidence) nasıl hesaplanıyor?",
    a: "Her ajan kendi çıktısı için 0-1 arası bir güven değeri üretir. Sentez ajanı bu değerleri ajan-bazlı kalibrasyon ağırlıkları ve geçmiş isabet oranıyla harmanlar. Sonuç, geçmiş test setinde Brier skoru ile doğrulanmış kalibre bir değerdir.",
  },
  {
    q: "ThesisForge bana hisse önerisi veriyor mu?",
    a: "Hayır. ThesisForge bir karar destek katmanıdır, sinyal üretici değildir. Bull/Bear/Katalist çerçevesinde gerekçeli bir tez sunar, kararı siz verirsiniz. Hiçbir ajan “al/sat” çıktısı üretmez.",
  },
  {
    q: "Ücretsiz deneyebilir miyim?",
    a: "Evet. Platform şu anda BTK Hackathon 2026 demo modundadır; kayıt olmadan örnek tezleri inceleyebilir, canlı komite akışını izleyebilirsiniz.",
  },
  {
    q: "Hangi hisseler destekleniyor?",
    a: "Demo modunda BIST 100 + likit BIST 50 dışı seçili sembol seti (TUPRS, GARAN, ASELS, EREGL, BIMAS, MEPET, THYAO vb.). Tam BIST kapsama backend entegrasyonu ile açılacak.",
  },
  {
    q: "Verilerim ve sorularım saklanıyor mu?",
    a: "Demo modunda kişisel veri toplanmaz; tez sonuçları yalnızca tarayıcı `localStorage` üzerinde tutulur. Üretim modunda kullanıcı hesabına bağlı tez geçmişi opt-in olacaktır.",
  },
  {
    q: "Çıktıyı export edebilir miyim?",
    a: "Her tez markdown olarak indirilebilir (kaynak referansları + ajan-bazlı çıktılar dahil). PDF export ve API erişimi roadmap’te.",
  },
];

export function Faq() {
  return (
    <section
      id="sss"
      className="relative border-b border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-card py-24"
    >
      <div className="mx-auto w-full max-w-[860px] px-6">
        <SectionHeader
          kicker="S.S.S."
          title="Sıkça Sorulan Sorular"
          subtitle="Komite, veri ve gizlilik üzerine en sık aldığımız sorular."
        />
        <div className="mt-12 grid grid-cols-1 gap-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-200 dark:border-border bg-card dark:bg-background transition-colors hover:border-slate-300 dark:hover:border-border/80 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center gap-4 px-6 py-5 outline-none">
                <span className="text-[14.5px] font-semibold text-slate-900 dark:text-white">
                  {faq.q}
                </span>
                <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-border text-slate-500 transition-transform group-open:rotate-45">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <div className="border-t border-slate-100 dark:border-border/50 px-6 pb-6 pt-4 text-[13.5px] leading-relaxed text-text-2">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
