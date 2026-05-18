import Link from "next/link";

export type LegalSection = {
  title: string;
  body: string;
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto w-full max-w-[880px] px-6 py-14">
      <Link
        href="/"
        className="text-[12.5px] font-semibold text-primary hover:underline"
      >
        Ana sayfaya dön
      </Link>
      <div className="mt-8 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-text-2">{intro}</p>

      <div className="mt-8 space-y-5">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {section.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-2">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
