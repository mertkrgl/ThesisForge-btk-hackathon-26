import { Building2, Landmark, Database, Newspaper } from "lucide-react";

const SOURCES = [
  {
    icon: Building2,
    name: "KAP",
    desc: "Kamuyu Aydınlatma Platformu bildirimleri",
  },
  { icon: Landmark, name: "TCMB EVDS", desc: "Makro veri ve faiz serileri" },
  { icon: Database, name: "MKK", desc: "Merkezi Kayıt Kuruluşu olay verisi" },
  { icon: Newspaper, name: "BIST Primary", desc: "Birincil piyasa veri akışı" },
];

export function DataSources() {
  return (
    <section
      id="kaynaklar"
      className="relative border-b border-slate-200 dark:border-border/60 bg-card dark:bg-background snap-section"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary">
            Veri Kaynakları
          </span>
          <h3 className="text-balance text-xl font-bold text-slate-900 dark:text-white md:text-2xl">
            Resmi ve birincil veriden beslenir.
          </h3>
          <p className="max-w-xl text-[13px] text-text-2">
            Tezlerin altındaki her satır, izlenebilir bir resmi kaynağa
            dayanır.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.name}
                className="glass flex items-center gap-3 rounded-xl p-4"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 dark:border-border bg-blue-50 dark:bg-secondary text-blue-600 dark:text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {s.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.desc}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
