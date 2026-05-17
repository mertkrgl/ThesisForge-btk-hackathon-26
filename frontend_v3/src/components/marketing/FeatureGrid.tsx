import {
  Quote,
  Gauge,
  Scale,
  Brain,
  Radio,
  Languages,
  type LucideIcon,
} from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  metric: string;
  mock: React.ReactNode;
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-slate-200 dark:border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:text-text-2">
    {children}
  </span>
);

const FEATURES: Feature[] = [
  {
    icon: Quote,
    title: "Kaynaklı her cümle",
    body: "Her argümanın yanında KAP, EVDS veya haber kaynağı. Tıklayın, doğrulayın.",
    metric: "Doğrulanabilir referans",
    mock: (
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>KAP-24Q3</Chip>
        <Chip>BIST-PX</Chip>
        <Chip>EVDS-2024</Chip>
      </div>
    ),
  },
  {
    icon: Gauge,
    title: "Kalibre güven skoru",
    body: "Ajan başına ve toplam tez için kalibre edilmiş, hesabı verilebilir bir confidence değeri.",
    metric: "Ajan başına confidence",
    mock: (
      <div className="w-[120px]">
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Güven</span>
          <span className="font-mono text-slate-900 dark:text-white">58%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
          <div className="h-full w-[58%] rounded-full bg-primary" />
        </div>
      </div>
    ),
  },
  {
    icon: Scale,
    title: "Bull / Bear / Katalist",
    body: "Yalnızca pozitif tablo değil; karşı senaryo ve olay takvimiyle birlikte üç boyutlu tez.",
    metric: "3 boyutlu çerçeve",
    mock: (
      <div className="flex items-center gap-2 text-[10.5px] font-mono">
        <span className="flex items-center gap-1 text-bull">
          <span className="h-1.5 w-1.5 rounded-full bg-bull" />
          Bull
        </span>
        <span className="flex items-center gap-1 text-bear">
          <span className="h-1.5 w-1.5 rounded-full bg-bear" />
          Bear
        </span>
        <span className="flex items-center gap-1 text-violet">
          <span className="h-1.5 w-1.5 rounded-full bg-violet" />
          Katalist
        </span>
      </div>
    ),
  },
  {
    icon: Brain,
    title: "Bellek katmanı",
    body: "Benzer geçmiş tezleri arar, hangi argümanların gerçekleştiğini hatırlatır.",
    metric: "Benzer geçmiş tezler",
    mock: (
      <div className="flex items-center gap-1.5">
        <Chip>12 benzer tez</Chip>
        <Chip>2024-09</Chip>
      </div>
    ),
  },
  {
    icon: Radio,
    title: "Streaming komite",
    body: "Tez canlı oluşur. WebSocket ile her token, her kaynak ve her güven adımı izlenir.",
    metric: "WebSocket akışı",
    mock: (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-border bg-background px-2 py-0.5 text-[10.5px] font-mono text-slate-600 dark:text-text-2">
        <span className="animate-blink h-1.5 w-1.5 rounded-full bg-bull" />
        CANLI
      </div>
    ),
  },
  {
    icon: Languages,
    title: "Türkçe-öncelikli",
    body: "BIST jargonu, KAP terminolojisi ve Türkçe haber akışı için özel olarak tasarlandı.",
    metric: "BIST + KAP jargonu",
    mock: (
      <div className="flex items-center gap-1.5">
        <Chip>tr-TR</Chip>
        <span className="font-mono text-[10.5px] text-slate-600 dark:text-text-2">
          “FAVÖK marjı”
        </span>
      </div>
    ),
  },
];

export function FeatureGrid() {
  return (
    <section
      id="urun"
      className="relative border-b border-slate-200 dark:border-border/60"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Özellikler"
          title="Premium karar destek katmanı."
          subtitle="Sinyal değil. Gerekçesi okunabilir, kaynağı doğrulanabilir bir tez ekosistemi."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl border border-slate-200 dark:border-border bg-card p-6 transition-colors hover:border-slate-300 dark:hover:border-border/80 md:p-7"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-border bg-background text-slate-700 dark:text-text-2">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                      {f.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-text-2">
                    {f.body}
                  </p>
                  <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                    → {f.metric}
                  </div>
                </div>
                <div className="hidden shrink-0 md:block">{f.mock}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
