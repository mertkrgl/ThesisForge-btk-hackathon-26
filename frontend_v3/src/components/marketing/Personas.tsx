import { SectionHeader } from "@/components/shared/SectionHeader";

function TrendMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 17 L9 11 L13 14 L21 5" />
      <path d="M15 5 H21 V11" />
    </svg>
  );
}

function BarsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className}>
      <line x1="5" y1="20" x2="5" y2="14" />
      <line x1="12" y1="20" x2="12" y2="9" />
      <line x1="19" y1="20" x2="19" y2="5" />
      <line x1="3" y1="22" x2="21" y2="22" />
    </svg>
  );
}

function QuoteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7.5 6c-2.5 0-4.5 2-4.5 4.5 0 2 1.4 3.7 3.3 4.3-.4 1.2-1.2 2.3-2.3 3 1.6-.2 3.2-1 4.4-2.2 1.4-1.4 2.1-3.2 2.1-5.1 0-2.5-1.5-4.5-3-4.5zm10 0c-2.5 0-4.5 2-4.5 4.5 0 2 1.4 3.7 3.3 4.3-.4 1.2-1.2 2.3-2.3 3 1.6-.2 3.2-1 4.4-2.2 1.4-1.4 2.1-3.2 2.1-5.1 0-2.5-1.5-4.5-3-4.5z" />
    </svg>
  );
}

type Persona = {
  mark: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  mock: React.ReactNode;
};

const PERSONAS: Persona[] = [
  {
    mark: TrendMark,
    title: "Bireysel Yatırımcılar",
    desc: "Duyguya kapılmadan, kurumsal fon yöneticisi seviyesinde derinlemesine hisse analizi yapın.",
    mock: (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-border bg-background px-3 py-2 font-mono text-[11.5px]">
        <span className="font-semibold text-slate-900 dark:text-white">THYAO</span>
        <span className="text-bull">↑ 2.1%</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-slate-600 dark:text-text-2">conf 0.83</span>
      </div>
    ),
  },
  {
    mark: BarsMark,
    title: "Fon Yöneticileri",
    desc: "Araştırma ve bilanço okuma sürenizi 4 saatten ~90 saniyeye indirin, karar hızınızı artırın.",
    mock: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between gap-4 rounded border border-slate-200 dark:border-border bg-background px-2.5 py-1">
          <span className="font-semibold text-slate-900 dark:text-white">TUPRS</span>
          <span className="text-bull">Bull</span>
          <span className="text-muted-foreground">0.71</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded border border-slate-200 dark:border-border bg-background px-2.5 py-1">
          <span className="font-semibold text-slate-900 dark:text-white">GARAN</span>
          <span className="text-bear">Bear</span>
          <span className="text-muted-foreground">0.62</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded border border-slate-200 dark:border-border bg-background px-2.5 py-1">
          <span className="font-semibold text-slate-900 dark:text-white">ASELS</span>
          <span className="text-bull">Bull</span>
          <span className="text-muted-foreground">0.58</span>
        </div>
      </div>
    ),
  },
  {
    mark: QuoteMark,
    title: "İçerik Üreticileri",
    desc: "Bültenleriniz ve yayınlarınız için saniyeler içinde objektif, veriye dayalı özetler çıkartın.",
    mock: (
      <div className="max-w-[280px] rounded-lg border border-slate-200 dark:border-border bg-background px-3 py-2">
        <p className="text-[12px] italic text-slate-700 dark:text-text-2">
          “BIST endeksi Q3’te enflasyon baskısına rağmen sanayi marjlarını korudu…”
        </p>
        <div className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
          — Bülten #14
        </div>
      </div>
    ),
  },
];

export function Personas() {
  return (
    <section
      id="personalar"
      className="relative border-b border-slate-200 dark:border-border/60 bg-background py-24"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <SectionHeader
          kicker="Kimler İçin"
          title="Her yatırımcı profiline uygun."
          subtitle="İster kendi portföyünüzü yönetin, ister kurumsal bir fon; ThesisForge karar alma sürecinize hız katar."
        />
        <div className="mt-12 grid grid-cols-1 gap-4">
          {PERSONAS.map((p) => {
            const Mark = p.mark;
            return (
              <div
                key={p.title}
                className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl border border-slate-200 dark:border-border bg-card p-6 transition-colors hover:border-slate-300 dark:hover:border-border/80 md:p-7"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-border bg-background text-slate-900 dark:text-white">
                      <Mark className="h-5 w-5" />
                    </div>
                    <h3 className="text-[17px] font-bold text-slate-900 dark:text-white">
                      {p.title}
                    </h3>
                  </div>
                  <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-text-2">
                    {p.desc}
                  </p>
                </div>
                <div className="hidden shrink-0 md:block">{p.mock}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
