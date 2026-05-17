import Image from "next/image";

type Logo = {
  src: string;
  darkSrc?: string;
  alt: string;
  /** Per-logo visual sizing — compensates for aspect-ratio differences so all logos read at the same optical weight. */
  sizeClass: string;
};

const LOGOS: Logo[] = [
  {
    src: "/logos/borsa-istanbul-logo.png",
    alt: "Borsa İstanbul",
    sizeClass: "h-12",
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
  },
  {
    src: "/logos/MKK-EN-Dikey-Logo-Siyah.png",
    alt: "MKK",
    sizeClass: "h-20",
  },
];

// Twice for seamless marquee loop (translateX -50%).
const TRACK = [...LOGOS, ...LOGOS];

function LogoMark({ logo }: { logo: Logo }) {
  return (
    <div className="flex h-24 shrink-0 items-center">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={320}
        height={96}
        className={`${logo.sizeClass} w-auto object-contain ${logo.darkSrc ? "dark:hidden" : ""}`}
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
          Gücünü aldığı veri kaynakları
        </p>
        <div className="marquee-mask mt-10 overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-24 md:gap-32">
            {TRACK.map((logo, i) => (
              <LogoMark key={`${logo.alt}-${i}`} logo={logo} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
