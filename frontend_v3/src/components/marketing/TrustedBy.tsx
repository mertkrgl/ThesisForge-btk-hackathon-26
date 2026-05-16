export function TrustedBy() {
  return (
    <section className="border-b border-slate-200 dark:border-border/60 bg-card py-10 snap-section">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Gücünü aldığı altyapılar ve veri kaynakları
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-50 grayscale dark:opacity-60 md:gap-16">
          <span className="font-mono text-[19px] font-bold text-slate-800 dark:text-white">Borsa İstanbul</span>
          <span className="font-sans text-[22px] font-extrabold tracking-tight text-slate-800 dark:text-white">KAP</span>
          <span className="font-mono text-[18px] font-semibold tracking-widest text-slate-800 dark:text-white">TCMB</span>
          <span className="font-serif text-[20px] font-bold italic text-slate-800 dark:text-white">MKK</span>
          <span className="font-sans text-[20px] font-medium tracking-tight text-slate-800 dark:text-white">Gemini</span>
        </div>
      </div>
    </section>
  );
}
