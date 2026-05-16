import { ChevronDown } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

const FAQS = [
  {
    q: "Yapay zeka halüsinasyon (uydurma) yapıyor mu?",
    a: "Hayır. ThesisForge RAG (Retrieval-Augmented Generation) mimarisiyle çalışır. Yani sadece sistemde bulunan resmi KAP bildirimleri ve raporlar üzerinden konuşur. Bilmediği konuda tahminde bulunmaz.",
  },
  {
    q: "Hangi verileri kullanıyorsunuz?",
    a: "Şu anda şirketlerin çeyreklik bilançoları, faaliyet raporları, KAP özel durum açıklamaları ve TCMB makroekonomik verileri temel alınmaktadır.",
  },
  {
    q: "Ücretsiz deneyebilir miyim?",
    a: "Evet, şu anda platformumuz demo modunda çalışmaktadır. Herhangi bir kayıt olmadan örnek tezleri inceleyebilir ve sistemin nasıl çalıştığını görebilirsiniz.",
  },
];

export function Faq() {
  return (
    <section id="sss" className="relative border-b border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-card py-24 snap-section">
      <div className="mx-auto w-full max-w-[800px] px-6">
        <SectionHeader
          kicker="S.S.S."
          title="Sıkça Sorulan Sorular"
        />
        <div className="mt-12 flex flex-col gap-4">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-200 dark:border-border bg-card dark:bg-background [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-semibold text-slate-900 dark:text-white outline-none">
                <span className="text-[15px]">{faq.q}</span>
                <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-border text-slate-500 transition-transform group-open:rotate-180">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </summary>
              <div className="border-t border-slate-100 dark:border-border/50 px-6 pb-6 pt-4 text-[14px] leading-relaxed text-text-2">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
