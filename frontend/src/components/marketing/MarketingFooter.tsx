import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-border/60 bg-slate-50 dark:bg-background">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo size="sm" />
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
            BIST için çok ajanlı yatırım tezi platformu. Kararlar size ait,
            kaynak ve gerekçe bizden.
          </p>
        </div>

        <FooterCol
          title="Ürün"
          items={[
            { label: "Canlı Komite", href: "/app/thesis/new" },
            { label: "Watchlist", href: "/app/watchlist" },
            { label: "Geçmiş Tezler", href: "/app/history" },
            { label: "Ayarlar", href: "/app/settings" },
          ]}
        />
        <FooterCol
          title="Kaynaklar"
          items={[
            { label: "BLUEPRINT", href: "#" },
            { label: "Veri Sözleşmesi", href: "#" },
            { label: "Disclaimer", href: "#" },
            { label: "Hackathon Notları", href: "#" },
          ]}
        />
        <FooterCol
          title="Topluluk"
          items={[
            { label: "GitHub", href: "https://github.com", external: true },
            { label: "Issue Aç", href: "#" },
            { label: "Discord", href: "#" },
          ]}
        />
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-3 px-6 py-5 text-[11.5px] text-muted-foreground md:flex-row md:items-center">
          <div>
            © {new Date().getFullYear()} ThesisForge · BTK Hackathon ·{" "}
            <span className="text-warn">Yatırım tavsiyesi değildir.</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Açık kaynak
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      <ul className="flex flex-col gap-2 text-[12.5px] text-text-2">
        {items.map((item) =>
          item.external ? (
            <li key={item.label}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-900 dark:hover:text-white"
              >
                {item.label}
              </a>
            </li>
          ) : (
            <li key={item.label}>
              <Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">
                {item.label}
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
