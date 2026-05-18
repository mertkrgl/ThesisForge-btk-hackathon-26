"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Plus, Star, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type TabItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  matchPrefix?: boolean;
};

const TABS: TabItem[] = [
  { label: "Anasayfa", href: "/app", icon: LayoutDashboard },
  { label: "Tezler", href: "/app/history", icon: History, matchPrefix: true },
  {
    label: "Yeni Tez",
    href: "/app/thesis/live",
    icon: Plus,
    highlight: true,
    matchPrefix: true,
  },
  { label: "Watchlist", href: "/app/watchlist", icon: Star },
  { label: "Profil", href: "/app/profile", icon: UserRound, matchPrefix: true },
];

function isActive(pathname: string, tab: TabItem): boolean {
  if (tab.matchPrefix) return pathname.startsWith(tab.href);
  return pathname === tab.href;
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "/app";
  return (
    <nav
      aria-label="Mobil ana menü"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md md:hidden"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(pathname, tab);
        if (tab.highlight) {
          // Ortadaki "Yeni Tez" FAB-tarzı yüzer buton — diğerlerinden öne çıkar.
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center justify-end pb-1 text-[10px] font-semibold text-primary"
            >
              <span className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(37,99,235,0.55)] ring-4 ring-card">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-1">{tab.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10.5px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-text-2",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "stroke-[2.2]")} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
