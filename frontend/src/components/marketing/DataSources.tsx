import Image from "next/image";

const SOURCES = [
  {
    logo: "/logos/kap-logo.jpeg",
    name: "KAP",
    desc: "Kamuyu Aydınlatma Platformu bildirimleri",
  },
  {
    logo: "/logos/borsa-istanbul-logo.png",
    name: "Borsa İstanbul",
    desc: "BIST seans verisi ve duyuruları",
  },
  {
    logo: "/logos/TCMB_logo.svg",
    name: "TCMB EVDS",
    desc: "Makro veri ve faiz serileri",
  },
  {
    logo: "/logos/MKK-EN-Dikey-Logo-Siyah.png",
    name: "MKK",
    desc: "Merkezi Kayıt Kuruluşu olay verisi",
  },
];

export function DataSources() {
  return (
    <section
      id="kaynaklar"
      className="relative border-b border-slate-200 dark:border-border/60 bg-card dark:bg-background"
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
          {SOURCES.map((s) => (
            <li
              key={s.name}
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-background p-4"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 dark:border-border bg-white p-1.5">
                <Image
                  src={s.logo}
                  alt={`${s.name} logosu`}
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                />
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
          ))}
        </ul>
      </div>
    </section>
  );
}
