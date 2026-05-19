"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Sparkles,
  Star,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useState } from "react";

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
        href: "/app/thesis/live",
        icon: Sparkles,
        badge: { text: "⌘N" },
      },
    ],
  },
  {
    title: "Keşif",
    items: [
      {
        label: "Şirketler",
        href: "/app/companies",
        icon: Building2,
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Takip",
    items: [
      {
        label: "Takip Edilen Hisseler",
        href: "/app/watchlist",
        icon: Star,
      },
      {
        label: "Tezler",
        href: "/app/history",
        icon: History,
      },
    ],
  },
  {
    title: "Sistem",
    items: [
      { label: "Hesabım", href: "/app/settings", icon: Settings },
    ],
  },
];

const COLLAPSED_KEY = "thesisforge.sidebar_collapsed";

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

export function Sidebar() {
  const pathname = usePathname() ?? "/app";
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((next) => {
      const value = !next;
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
      } catch {
        /* localStorage unavailable */
      }
      return value;
    });
  };

  const displayName = user?.name ?? user?.email ?? "Kullanıcı";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh min-h-dvh self-start overflow-visible flex-col border-r border-slate-200 bg-card py-4 transition-[width,padding] duration-300 ease-out dark:border-border dark:bg-[linear-gradient(180deg,#0A1020,#070A12)] md:flex",
        collapsed ? "w-[82px] px-3" : "w-[240px] px-3.5",
      )}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute right-0 top-20 z-40 grid h-8 w-8 translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-card text-slate-600 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)] transition-colors hover:border-primary/40 hover:text-primary dark:border-border dark:bg-[#0B1220] dark:text-text-2 dark:hover:text-white"
        title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
        aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4 stroke-[2.8]" />
        ) : (
          <ChevronsLeft className="h-4 w-4 stroke-[2.8]" />
        )}
      </button>

      <Link
        href="/app"
        aria-label="ThesisForge"
        className={cn(
          "mb-2.5 flex shrink-0 items-center gap-2.5 border-b border-dashed border-border pb-4 pt-2",
          collapsed ? "h-[76px] justify-center px-0" : "px-2.5",
        )}
      >
        {collapsed && (
          <Logo size="lg" markOnly />
        )}
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200",
            collapsed && "pointer-events-none sr-only opacity-0",
          )}
        >
          <Logo size="md" />
        </div>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((section) => (
          <div key={section.title}>
            <div
              className={cn(
                "px-2.5 pb-1.5 pt-3.5 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-200",
                collapsed && "sr-only opacity-0",
              )}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-xl text-[13.5px] text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-text-2 dark:hover:bg-secondary dark:hover:text-white",
                    collapsed
                      ? "h-11 justify-center px-0"
                      : "gap-2.5 px-2.5 py-2",
                    active &&
                      "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563EB,0_8px_24px_-18px_rgba(37,99,235,0.8)] dark:border dark:border-border dark:bg-accent dark:text-white dark:shadow-none"
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
                  <Icon
                    className={cn(
                      "relative z-10 h-5 w-5 opacity-95",
                      active
                        ? "stroke-[2.8]"
                        : "stroke-[2.45]",
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-10 min-w-0 truncate transition-opacity duration-200",
                      collapsed && "sr-only opacity-0",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.badge && !collapsed && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 py-0.5 text-[10.5px]",
                        item.badge.tone === "live"
                          ? "bg-bull/15 text-bull"
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
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-dashed border-border pt-3",
          collapsed
            ? "flex flex-col items-center gap-3"
            : "flex items-center gap-2.5",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center",
            collapsed ? "w-full justify-center" : "gap-2.5",
          )}
        >
          <div
            className={cn(
              "grid place-items-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] font-bold text-white shadow-[0_10px_24px_-16px_rgba(59,130,246,0.9)]",
              collapsed ? "h-10 w-10 text-[14px]" : "h-[30px] w-[30px] text-[12px]",
            )}
          >
            {initials}
          </div>
          <div
            className={cn(
              "min-w-0 text-[12.5px] leading-tight transition-opacity duration-200",
              collapsed && "sr-only opacity-0",
            )}
          >
            <div className="truncate font-semibold text-slate-900 dark:text-white">{displayName}</div>
            <div className="text-[10.5px] text-muted-foreground">{user?.email ?? ""}</div>
          </div>
        </div>
        {!collapsed && <ThemeToggle />}
      </div>
    </aside>
  );
}
