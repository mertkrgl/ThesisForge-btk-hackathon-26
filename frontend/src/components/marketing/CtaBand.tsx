import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 tf-aurora-bg opacity-90" aria-hidden />
      <div className="absolute inset-0 tf-grid-bg opacity-30" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 py-24 text-center">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-text-2">
          <Sparkles className="h-3 w-3 text-violet" />
          BTK Hackathon 2026
        </div>
        <h2 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          BIST&apos;in ilk{" "}
          <span className="tf-gradient-text">açık komite</span> platformu.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[14px] text-text-2">
          Demo modunda hemen deneyin. Backend bağlandığında aynı arayüz canlı
          tez üretmeye başlayacak.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-[13.5px] font-semibold text-primary-foreground shadow-[0_18px_40px_-14px_#3B82F6] transition-all hover:bg-[#2563EB]"
          >
            Uygulamayı Aç
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/app/thesis/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-5 text-[13.5px] font-medium text-text-2 transition-colors hover:border-line-2 hover:text-white"
          >
            Demo Tezi Çalıştır
          </Link>
        </div>
      </div>
    </section>
  );
}
