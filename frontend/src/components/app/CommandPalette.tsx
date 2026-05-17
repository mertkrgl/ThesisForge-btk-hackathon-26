"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  LayoutDashboard,
  History,
  Star,
  Settings,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Gezinme" | "Eylem" | "Sembol";
  icon: React.ComponentType<{ className?: string }>;
  run: (router: ReturnType<typeof useRouter>) => void;
};

const CMDS: Cmd[] = [
  {
    id: "go-dash",
    label: "Dashboard'a git",
    group: "Gezinme",
    icon: LayoutDashboard,
    run: (r) => r.push("/app"),
  },
  {
    id: "go-new",
    label: "Yeni tez başlat",
    hint: "⌘N",
    group: "Eylem",
    icon: Sparkles,
    run: (r) => r.push("/app/thesis/live"),
  },
  {
    id: "go-history",
    label: "Geçmiş tezleri aç",
    group: "Gezinme",
    icon: History,
    run: (r) => r.push("/app/history"),
  },
  {
    id: "go-watch",
    label: "Watchlist",
    group: "Gezinme",
    icon: Star,
    run: (r) => r.push("/app/watchlist"),
  },
  {
    id: "go-settings",
    label: "Ayarlar",
    group: "Gezinme",
    icon: Settings,
    run: (r) => r.push("/app/settings"),
  },
  {
    id: "tup",
    label: "Tez başlat: TUPRS",
    group: "Sembol",
    icon: FileText,
    run: (r) => r.push("/app/thesis/live?symbol=TUPRS"),
  },
  {
    id: "asels",
    label: "Tez başlat: ASELS",
    group: "Sembol",
    icon: FileText,
    run: (r) => r.push("/app/thesis/live?symbol=ASELS"),
  },
  {
    id: "ereg",
    label: "Tez başlat: EREGL",
    group: "Sembol",
    icon: FileText,
    run: (r) => r.push("/app/thesis/live?symbol=EREGL"),
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CMDS;
    return CMDS.filter((c) => c.label.toLowerCase().includes(s));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      setQ("");
      setActive(0);
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) {
          cmd.run(router);
          onOpenChange(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, router, onOpenChange]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  let idx = -1;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-items-center pt-[18vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-[min(640px,92vw)] overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] glass-strong tf-rise">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Komut, sayfa veya sembol ara…"
            className="flex-1 bg-transparent text-[14px] text-slate-900 dark:text-white placeholder:text-muted-foreground focus:outline-none"
          />
          <span className="rounded border border-border bg-[#1A243F] px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            ESC
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group}
              </div>
              {items.map((c) => {
                idx += 1;
                const Icon = c.icon;
                const isActive = idx === active;
                const myIdx = idx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setActive(myIdx)}
                    onClick={() => {
                      c.run(router);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-text-2 transition-colors",
                      isActive
                        ? "bg-blue-50 dark:bg-accent text-blue-700 dark:text-white"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    )}
                  >
                    <Icon className="h-4 w-4 opacity-80" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && (
                      <span className="rounded border border-border bg-[#1A243F] px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                        {c.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              Sonuç yok.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10.5px] text-muted-foreground">
          <span>Komut paleti</span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-[#1A243F] px-1 py-px font-mono text-[10px]">
              ↑↓
            </kbd>
            gez ·
            <kbd className="rounded border border-border bg-[#1A243F] px-1 py-px font-mono text-[10px]">
              ⏎
            </kbd>
            seç
          </span>
        </div>
      </div>
    </div>
  );
}
