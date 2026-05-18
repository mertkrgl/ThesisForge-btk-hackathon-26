"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ChevronDown,
  Keyboard,
  LogIn,
  LogOut,
  Settings,
  User,
  UserPlus,
} from "lucide-react";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { useAuth } from "@/lib/auth/AuthProvider";

function initials(seed: string): string {
  const parts = seed.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return seed.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Loading sırasında skeleton — flash önleyici
  if (isLoading) {
    return (
      <div className="h-9 w-[120px] animate-pulse rounded-lg border border-border bg-card/60" />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Giriş yap</span>
        </Link>
        <Link
          href="/register"
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_#3B82F6] transition-all hover:bg-[#2563EB] sm:inline-flex"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Kayıt ol
        </Link>
      </div>
    );
  }

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Kullanıcı";
  const avatar = initials(displayName);

  const handleLogout = () => {
    logout();
    setOpen(false);
    // Sayfada kal — anonim state'e geçince ilgili componentlar (Watchlist,
    // UserMenu, IdleHero guard) kendi anonim render'larına re-render eder.
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1 pr-2 text-[12.5px] text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-border dark:bg-muted dark:text-text-2 dark:hover:border-border dark:hover:text-white"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] font-mono text-[11px] font-bold text-white">
          {avatar}
        </span>
        <span className="hidden max-w-[140px] truncate font-semibold text-slate-900 dark:text-white sm:inline">
          {displayName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[240px] overflow-hidden rounded-xl border border-border bg-card/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] glass-strong tf-rise">
          <div className="border-b border-border px-4 py-3">
            <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
              {displayName}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {user?.email}
            </div>
          </div>
          <div className="py-1">
            <MenuItem href="/app/profile" icon={User} label="Profil" />
            <MenuItem
              href="/app/settings"
              icon={Settings}
              label="Ayarlar"
              hint="⌘,"
            />
            <MenuItem
              icon={Keyboard}
              label="Kısayollar"
              hint="?"
              onClick={() => setOpen(false)}
            />
          </div>
          <div className="border-t border-border py-1">
            <MenuItem
              icon={LogOut}
              label="Çıkış yap"
              destructive
              onClick={handleLogout}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  hint,
  destructive,
  onClick,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  destructive?: boolean;
  onClick?: () => void;
}) {
  const base =
    "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[12.5px] transition-colors hover:bg-white/[0.03]";
  const color = destructive
    ? "text-bear"
    : "text-slate-600 hover:text-slate-900 dark:text-text-2 dark:hover:text-white";
  const body = (
    <>
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="rounded border border-border bg-[#1A243F] px-1 py-px font-mono text-[10px] text-muted-foreground">
          {hint}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={`${base} ${color}`}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${color}`}>
      {body}
    </button>
  );
}
