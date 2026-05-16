import { Search, Users, Brain, ScrollText } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

const STEPS = [
  {
    icon: Search,
    title: "Hisse & soru",
    body: "Bir BIST sembolü seçin (örn. TUPRS) veya doğal dilde bir soru sorun.",
  },
  {
    icon: Users,
    title: "Komite müzakere eder",
    body: "8 ajan paralel çalışır; teknik, temel, devil's advocate ve bellek katmanı tartışır.",
  },
  {
    icon: Brain,
    title: "Sentez + güven",
    body: "Sentez ajanı bull/bear/katalist tezini özetler, kalibre edilmiş güven skoru üretir.",
  },
  {
    icon: ScrollText,
    title: "Karar destek",
    body: "Her cümle kaynaklı, her tez kaydedilebilir. Kararı siz verirsiniz.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      className="relative border-b border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-background snap-section"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Nasıl çalışır"
          title="Soru sorun, komite çalışsın."
          subtitle="ThesisForge bir kara kutu değil. Her adımı izleyebilir, her argümanın altında kaynak görebilirsiniz."
          kickerTone="cyan"
        />

        <ol className="relative mt-14 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div
            className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px md:block"
            style={{
              background:
                "linear-gradient(90deg,transparent 0%,#1E2A44 12%,#1E2A44 88%,transparent 100%)",
            }}
            aria-hidden
          />
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative rounded-2xl border border-slate-200 dark:border-border bg-card dark:bg-card/60 p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-[52px] w-[52px] place-items-center rounded-xl border border-slate-200 dark:border-border bg-card dark:bg-secondary shadow-sm dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-mono text-[28px] font-bold text-line-2">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-4 text-[15px] font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
