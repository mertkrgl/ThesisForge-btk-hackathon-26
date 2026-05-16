"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  app: "Uygulama",
  thesis: "Tezler",
  new: "Yeni Tez",
  live: "Canlı Komite",
  history: "Geçmiş",
  watchlist: "Watchlist",
  settings: "Ayarlar",
  backtest: "Backtest",
};

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/app";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
    >
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = LABELS[seg] ?? decodeURIComponent(seg);
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
            {isLast ? (
              <span className="font-semibold text-slate-900">{label}</span>
            ) : (
              <Link href={href} className="transition-colors hover:text-slate-900">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
