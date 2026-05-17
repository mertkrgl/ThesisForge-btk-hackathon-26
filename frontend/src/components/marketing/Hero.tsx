import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

export function Hero({ demo }: { demo?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      <div className="relative mx-auto grid w-full max-w-[1280px] gap-12 px-6 pb-20 pt-16 md:grid-cols-[1.05fr_1fr] md:pb-28 md:pt-24">
        <div className="flex flex-col">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 dark:border-border bg-card dark:bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-text-2">
            <span className="h-1.5 w-1.5 rounded-full bg-bull" />
            BIST için yatırım komitesi · Demo modu
          </div>

          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-[64px]">
            <span className="block text-slate-900 dark:text-white">8 ajanlı yapay zekâ</span>
            <span className="block text-slate-900 dark:text-white">
              yatırım komitesi.
            </span>
            <span className="mt-3 block text-2xl font-semibold text-text-2 md:text-[26px]">
              Tezi okuyun, kararı siz verin.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-text-2">
            ThesisForge, BIST hisseleri için{" "}
            <span className="text-slate-900 font-semibold dark:text-white">bull/bear/katalist</span> tezi
            üretir; her cümlenin altında kaynak, her tezin yanında bir{" "}
            <span className="text-slate-900 font-semibold dark:text-white">güven skoru</span> bulunur. Sinyal
            değil, gerekçeli bir karar destek katmanı.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/app/thesis/live"
              className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
            >
              Demo&apos;yu Başlat
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#nasil-calisir"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 dark:border-border bg-card dark:bg-accent/50 px-4 text-[13.5px] font-medium text-slate-600 dark:text-text-2 transition-colors hover:border-slate-300 dark:hover:border-border hover:text-slate-900 dark:hover:text-white"
            >
              <Play className="h-3.5 w-3.5" />
              Nasıl çalışır?
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border/60 pt-6">
            <Stat label="Uzman ajan" value="8" />
            <Stat label="Resmi kaynak" value="4" />
            <Stat label="Tez boyutu" value="3" subvalue="Bull · Bear · Katalist" />
          </dl>
        </div>

        <div className="relative flex min-h-[420px] items-center">
          {demo ?? <HeroDemoFallback />}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </dd>
      {subvalue && (
        <div className="mt-0.5 text-[10.5px] text-text-2">{subvalue}</div>
      )}
    </div>
  );
}

function HeroDemoFallback() {
  return (
    <div className="glass relative w-full overflow-hidden rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-violet/20 font-mono text-[11px] font-semibold text-violet">
            TF
          </span>
          <div>
            <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white">
              TUPRS · Tüpraş
            </div>
            <div className="text-[10.5px] text-muted-foreground">
              Komite hazırlanıyor…
            </div>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 dark:border-border bg-slate-50 dark:bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:text-text-2">
          DEMO
        </span>
      </div>
      <div className="mt-5 h-[280px] rounded-xl border border-dashed border-slate-200 dark:border-border/70 bg-slate-50 dark:bg-background/40" />
    </div>
  );
}
