import {
  Quote,
  Gauge,
  Scale,
  Brain,
  Radio,
  Languages,
} from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { cn } from "@/lib/utils";
import { StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/MotionWrappers";

const FEATURES = [
  {
    icon: Quote,
    title: "Kaynaklı her cümle",
    body: "Her argümanın yanında KAP, EVDS veya haber kaynağı. Tıklayın, doğrulayın.",
    tone: "primary",
  },
  {
    icon: Gauge,
    title: "Kalibre güven skoru",
    body: "Ajan başına ve toplam tez için kalibre edilmiş, hesabı verilebilir bir confidence değeri.",
    tone: "cyan",
  },
  {
    icon: Scale,
    title: "Bull / Bear / Katalist",
    body: "Yalnızca pozitif tablo değil; karşı senaryo ve olay takvimiyle birlikte üç boyutlu tez.",
    tone: "violet",
  },
  {
    icon: Brain,
    title: "Bellek katmanı",
    body: "Benzer geçmiş tezleri arar, hangi argümanların gerçekleştiğini hatırlatır.",
    tone: "warn",
  },
  {
    icon: Radio,
    title: "Streaming komite",
    body: "Tez canlı oluşur. WebSocket ile her token, her kaynak ve her güven adımı izlenir.",
    tone: "bull",
  },
  {
    icon: Languages,
    title: "Türkçe-öncelikli",
    body: "BIST jargonu, KAP terminolojisi ve Türkçe haber akışı için özel olarak tasarlandı.",
    tone: "bear",
  },
] as const;

const TONE: Record<string, { ring: string; text: string; bg: string }> = {
  primary: { ring: "border-primary/30", text: "text-primary", bg: "bg-primary/10" },
  cyan: { ring: "border-cyan/30", text: "text-cyan", bg: "bg-cyan/10" },
  violet: { ring: "border-violet/30", text: "text-violet", bg: "bg-violet/10" },
  warn: { ring: "border-warn/30", text: "text-warn", bg: "bg-warn/10" },
  bull: { ring: "border-bull/30", text: "text-bull", bg: "bg-bull/10" },
  bear: { ring: "border-bear/30", text: "text-bear", bg: "bg-bear/10" },
};

export function FeatureGrid() {
  return (
    <section id="urun" className="relative border-b border-slate-200 dark:border-border/60">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Özellikler"
          title="Premium karar destek katmanı."
          subtitle="Sinyal değil. Gerekçesi okunabilir, kaynağı doğrulanabilir bir tez ekosistemi."
        />
        <StaggerContainer
          stagger={0.07}
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const t = TONE[f.tone];
            return (
              <StaggerItem key={f.title}>
                <HoverCard>
                  <div
                    className="group rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-6 shadow-sm dark:shadow-none transition-all hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-border hover:shadow-md dark:hover:shadow-none"
                  >
                    <div
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-xl border",
                        t.ring,
                        t.bg,
                        t.text
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-slate-900 dark:text-white">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">
                      {f.body}
                    </p>
                  </div>
                </HoverCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
