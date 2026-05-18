import Image from "next/image";

type Logo = {
  src: string;
  darkSrc?: string;
  invertInDark?: boolean;
  whiteBgInDark?: boolean;
  alt: string;
  /** Per-logo visual sizing — compensates for aspect-ratio differences so all logos read at the same optical weight. */
  sizeClass: string;
};

const LOGOS: Logo[] = [
  {
    src: "/logos/borsa-istanbul-logo.png",
    alt: "Borsa İstanbul",
    sizeClass: "h-12",
    whiteBgInDark: true,
  },
  {
    src: "/logos/kap-logo.jpeg",
    alt: "KAP",
    sizeClass: "h-16",
  },
  {
    src: "/logos/TCMB_logo.svg",
    alt: "TCMB",
    sizeClass: "h-10",
    whiteBgInDark: true,
  },
  {
    src: "/logos/MKK-EN-Dikey-Logo-Siyah.png",
    alt: "MKK",
    sizeClass: "h-20",
    invertInDark: true,
  },
];

const LIBRARY_LOGOS: Logo[] = [
  {
    src: "/logos/strands-logo-black.svg",
    darkSrc: "/logos/logo-header-dark.LyjuOEMF.svg",
    alt: "Strands Agents",
    sizeClass: "h-9 max-w-[170px]",
  },
  {
    src: "/logos/yfinance-logo.webp",
    darkSrc: "/logos/yfinance-white.webp",
    alt: "yfinance",
    sizeClass: "h-9 max-w-[170px]",
  },
  {
    src: "/logos/gemini-logo.svg",
    alt: "Gemini",
    sizeClass: "h-9 max-w-[170px]",
  },
  {
    src: "/logos/pandas_ta-logo.webp",
    alt: "pandas-ta",
    sizeClass: "h-9 max-w-[170px]",
  },
];

// Twice for seamless marquee loop (translateX -50%).
const TRACK = [...LOGOS, ...LOGOS];
const LIBRARY_TRACK = [...LIBRARY_LOGOS, ...LIBRARY_LOGOS];

function LogoMark({ logo }: { logo: Logo }) {
  return (
    <div className="flex h-24 shrink-0 items-center">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={320}
        height={96}
        className={`${logo.sizeClass} w-auto object-contain ${
          logo.darkSrc
            ? "dark:hidden"
            : logo.invertInDark
              ? "dark:invert"
              : logo.whiteBgInDark
                ? "dark:bg-white dark:p-2 dark:rounded-xl"
                : ""
        }`}
      />
      {logo.darkSrc && (
        <Image
          src={logo.darkSrc}
          alt={logo.alt}
          width={320}
          height={96}
          className={`${logo.sizeClass} hidden w-auto object-contain dark:block`}
        />
      )}
    </div>
  );
}

export function TrustedBy() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Gücünü Aldığı Veri Kaynakları
        </p>
        <div className="marquee-mask mt-10 overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-24 md:gap-32">
            {TRACK.map((logo, i) => (
              <LogoMark key={`${logo.alt}-${i}`} logo={logo} />
            ))}
          </div>
        </div>
        <p className="mt-14 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Kullandığı Teknolojiler
        </p>
        <div className="marquee-mask mt-8 overflow-hidden">
          <div className="animate-marquee-reverse flex w-max items-center gap-24 md:gap-32">
            {LIBRARY_TRACK.map((logo, i) => (
              <LogoMark key={`${logo.alt}-${i}`} logo={logo} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
