"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronDown, Keyboard, LogOut, Settings, User } from "lucide-react";
import { useClickOutside } from "@/components/shared/useClickOutside";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-line bg-[#0E1830] py-1 pl-1 pr-2 text-[12.5px] text-text-2 transition-all hover:border-line-2 hover:text-white"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] font-mono text-[11px] font-bold text-white">
          MG
        </span>
        <span className="hidden font-semibold text-white sm:inline">
          Melih Genel
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[240px] overflow-hidden rounded-xl border border-line bg-[#0B1220]/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] glass-strong tf-rise">
          <div className="border-b border-line px-4 py-3">
            <div className="text-[13px] font-semibold text-white">
              Melih Genel
            </div>
            <div className="text-[11px] text-muted-foreground">
              mlihgenel@gmail.com
            </div>
          </div>
          <div className="py-1">
            <MenuItem href="/app/settings" icon={User} label="Profil" />
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
          <div className="border-t border-line py-1">
            <MenuItem
              icon={LogOut}
              label="Çıkış yap"
              destructive
              onClick={() => setOpen(false)}
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
  const color = destructive ? "text-[#FCA5A5]" : "text-text-2 hover:text-white";
  const body = (
    <>
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="rounded border border-line bg-[#1A243F] px-1 py-px font-mono text-[10px] text-muted-foreground">
          {hint}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`${base} ${color}`}
      >
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
