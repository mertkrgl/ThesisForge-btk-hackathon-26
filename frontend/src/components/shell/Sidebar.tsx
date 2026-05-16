"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Radio,
  FileText,
  Star,
  LineChart,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: { text: string; tone?: "default" | "live" };
  matchPrefix?: boolean;
};

type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "Çalışma Alanı",
    items: [
      { label: "Dashboard", href: "/app", icon: LayoutDashboard },
      {
        label: "Yeni Tez",
        href: "/app/thesis/new",
        icon: Sparkles,
        badge: { text: "⌘N" },
      },
      {
        label: "Canlı Komite",
        href: "/app/thesis/live",
        icon: Radio,
        badge: { text: "CANLI", tone: "live" },
      },
      {
        label: "Tez Görüntüleyici",
        href: "/app/thesis",
        icon: FileText,
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Takip",
    items: [
      {
        label: "Watchlist",
        href: "/app/watchlist",
        icon: Star,
        badge: { text: "5" },
      },
      { label: "Backtest Demo", href: "/app/backtest", icon: LineChart },
      {
        label: "Geçmiş Tezler",
        href: "/app/history",
        icon: History,
        badge: { text: "24" },
      },
    ],
  },
  {
    title: "Sistem",
    items: [{ label: "Ayarlar", href: "/app/settings", icon: Settings }],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

export function Sidebar() {
  const pathname = usePathname() ?? "/app";

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-1 border-r border-line bg-[linear-gradient(180deg,#0A1020,#070A12)] px-3.5 py-4">
      <Link
        href="/app"
        className="mb-2.5 flex items-center gap-2.5 border-b border-dashed border-line px-2.5 pb-4 pt-2"
      >
        <div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#3B82F6_0%,#1D4ED8_50%,#0B1220_100%)] shadow-[0_6px_20px_-8px_#3B82F6,inset_0_0_0_1px_#2A4D9C]">
          <Sparkles className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <div className="text-[16px] font-extrabold leading-tight tracking-tight">
            ThesisForge
          </div>
          <div className="mt-[1px] text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Yatırım Komitesi
          </div>
        </div>
      </Link>

      {NAV.map((section) => (
        <div key={section.title}>
          <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {section.title}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-text-2 transition-all hover:bg-[#0F1A30] hover:text-white",
                  active &&
                    "bg-[linear-gradient(90deg,#13213F_0%,#0E1830_100%)] text-white shadow-[inset_0_0_0_1px_#1E2A44]"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 opacity-90" />
                <span className="relative z-10">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10.5px]",
                      item.badge.tone === "live"
                        ? "bg-bull/15 text-[#86EFAC]"
                        : "bg-line text-dim"
                    )}
                  >
                    {item.badge.text}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex items-center gap-2.5 border-t border-dashed border-line pt-3">
        <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] text-[12px] font-bold text-white">
          MG
        </div>
        <div className="text-[12.5px] leading-tight">
          <div className="font-semibold text-white">Melih Genel</div>
          <div className="text-[10.5px] text-muted-foreground">Hackathon</div>
        </div>
      </div>
    </aside>
  );
}
