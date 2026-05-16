import { User, Briefcase, PenTool } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

const PERSONAS = [
  {
    icon: User,
    title: "Bireysel Yatırımcılar",
    desc: "Duyguya kapılmadan, kurumsal fon yöneticisi seviyesinde derinlemesine hisse analizi yapın.",
  },
  {
    icon: Briefcase,
    title: "Fon Yöneticileri",
    desc: "Araştırma ve bilanço okuma sürenizi 4 saatten 45 saniyeye indirin, karar hızınızı artırın.",
  },
  {
    icon: PenTool,
    title: "İçerik Üreticileri",
    desc: "Bültenleriniz ve yayınlarınız için saniyeler içinde objektif, veriye dayalı özetler çıkartın.",
  },
];

export function Personas() {
  return (
    <section id="personalar" className="relative border-b border-slate-200 dark:border-border/60 bg-background py-24 snap-section">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <SectionHeader
          kicker="Kimler İçin"
          title="Her yatırımcı profiline uygun."
          subtitle="İster kendi portföyünüzü yönetin, ister kurumsal bir fon; ThesisForge karar alma sürecinize hız katar."
        />
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border border-slate-200 dark:border-border bg-card p-8 transition-colors hover:border-primary/40 dark:hover:border-primary/50">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-primary/10 text-blue-600 dark:text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-[18px] font-bold text-slate-900 dark:text-white">{p.title}</h3>
                <p className="text-[14px] leading-relaxed text-text-2">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
