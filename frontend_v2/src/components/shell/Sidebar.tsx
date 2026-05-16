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
    <aside className="sticky top-0 flex h-screen flex-col gap-1 border-r border-slate-200 bg-white px-3.5 py-4">
      <Link
        href="/app"
        className="mb-2.5 flex items-center gap-2.5 border-b border-dashed border-line px-2.5 pb-4 pt-2"
      >
        <div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#3B82F6_0%,#1D4ED8_50%,#1E40AF_100%)] shadow-[0_6px_20px_-8px_#3B82F680]">
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
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900",
                  active &&
                    "bg-blue-50 text-blue-700 shadow-[inset_2px_0_0_#2563EB]"
                )}
              >
                <Icon className="h-4 w-4 opacity-90" />
                <span>{item.label}</span>
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
        <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[linear-gradient(135deg,#2563EB,#7C3AED)] text-[12px] font-bold text-white">
          MG
        </div>
        <div className="text-[12.5px] leading-tight">
          <div className="font-semibold text-slate-900">Melih Genel</div>
          <div className="text-[10.5px] text-muted-foreground">Hackathon</div>
        </div>
      </div>
    </aside>
  );
}
