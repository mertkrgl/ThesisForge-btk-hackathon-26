import { Search, Users, Brain, ScrollText, type LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
  detail: string;
  mock: React.ReactNode;
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-slate-200 dark:border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:text-text-2">
    {children}
  </span>
);

const STEPS: Step[] = [
  {
    icon: Search,
    title: "Hisse & soru",
    body: "Bir BIST sembolü seçin ya da doğal dilde bir soru sorun. Sistem mandayı yorumlar.",
    detail: "Girdi: sembol + (opsiyonel) doğal dil",
    mock: (
      <div className="flex items-center gap-1.5">
        <Chip>TUPRS</Chip>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          “Q4 marj baskısı var mı?”
        </span>
      </div>
    ),
  },
  {
    icon: Users,
    title: "Komite müzakere eder",
    body: "8 ajan paralel çalışır; teknik, temel, devil's advocate ve bellek katmanı tartışır.",
    detail: "Paralel akış · WebSocket token stream",
    mock: (
      <div className="flex items-center gap-1.5">
        <span className="animate-blink h-1.5 w-1.5 rounded-full bg-bull" />
        <Chip>8 ajan</Chip>
        <Chip>~3.2s</Chip>
      </div>
    ),
  },
  {
    icon: Brain,
    title: "Sentez + güven",
    body: "Sentez ajanı bull/bear/katalist tezini özetler, kalibre edilmiş güven skoru üretir.",
    detail: "Çıktı: 3 boyutlu tez + confidence",
    mock: (
      <div className="w-[120px]">
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Güven</span>
          <span className="font-mono text-slate-900 dark:text-white">68%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
          <div className="h-full w-[68%] rounded-full bg-primary" />
        </div>
      </div>
    ),
  },
  {
    icon: ScrollText,
    title: "Karar destek",
    body: "Her cümle kaynaklı, her tez kaydedilebilir. Kararı siz verirsiniz; sistem öneri vermez.",
    detail: "Karar: kullanıcıda · sinyal yok",
    mock: (
      <div className="flex items-center gap-1.5">
        <Chip>KAP-24Q3</Chip>
        <Chip>BIST-PX</Chip>
        <Chip>EVDS</Chip>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      className="relative border-b border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-background"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Nasıl çalışır"
          title="Soru sorun, komite çalışsın."
          subtitle="ThesisForge bir kara kutu değil. Her adımı izleyebilir, her argümanın altında kaynak görebilirsiniz."
          kickerTone="cyan"
        />

        <ol className="mt-12 grid grid-cols-1 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-6 rounded-2xl border border-slate-200 dark:border-border bg-card p-6 transition-colors hover:border-slate-300 dark:hover:border-border/80 md:p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[22px] font-bold text-line-2">
                    0{i + 1}
                  </span>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-border bg-background text-slate-700 dark:text-text-2">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">
                    {step.body}
                  </p>
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    → {step.detail}
                  </div>
                </div>
                <div className="hidden shrink-0 md:block">{step.mock}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
