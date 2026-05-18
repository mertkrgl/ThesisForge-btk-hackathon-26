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
  X,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listCompanies, type CompanyRow } from "@/lib/api/companies";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Gezinme" | "Eylem" | "Şirket";
  icon: React.ComponentType<{ className?: string }>;
  run: (router: ReturnType<typeof useRouter>) => void;
};

const STATIC_CMDS: Cmd[] = [
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
    id: "go-companies",
    label: "Şirketler",
    group: "Gezinme",
    icon: Building2,
    run: (r) => r.push("/app/companies"),
  },
  {
    id: "go-settings",
    label: "Ayarlar",
    group: "Gezinme",
    icon: Settings,
    run: (r) => r.push("/app/settings"),
  },
];


function companyToCmd(c: CompanyRow): Cmd {
  return {
    id: `company-${c.ticker}`,
    label: `${c.ticker} — ${c.title}`,
    hint: c.member_type ?? undefined,
    group: "Şirket",
    icon: FileText,
    run: (r) => r.push(`/app/watchlist/${c.ticker}`),
  };
}

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
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchIdRef = useRef(0);

  // Şirket araması — debounced 200ms
  useEffect(() => {
    const s = q.trim();
    const id = ++fetchIdRef.current;

    if (!s) {
      setCompanies([]);
      setLoadingCompanies(false);
      return;
    }

    setLoadingCompanies(true);
    const t = setTimeout(() => {
      listCompanies({ search: s, limit: 8, offset: 0 })
        .then((res) => {
          if (fetchIdRef.current !== id) return;
          setCompanies(res.items);
        })
        .catch(() => {
          if (fetchIdRef.current !== id) return;
          setCompanies([]);
        })
        .finally(() => {
          if (fetchIdRef.current !== id) return;
          setLoadingCompanies(false);
        });
    }, 200);

    return () => clearTimeout(t);
  }, [q]);

  const filtered = useMemo<Cmd[]>(() => {
    const s = q.trim().toLowerCase();
    const staticFiltered = s
      ? STATIC_CMDS.filter((c) => c.label.toLowerCase().includes(s))
      : STATIC_CMDS;
    const companyCmds = companies.map(companyToCmd);
    return [...staticFiltered, ...companyCmds];
  }, [q, companies]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      setQ("");
      setActive(0);
      setCompanies([]);
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
    // Backdrop — tıklayınca kapat
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-items-center pt-[18vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={() => onOpenChange(false)}
    >
      {/* Panel — tıklamayı durdur */}
      <div
        className="relative w-[min(640px,92vw)] overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] glass-strong tf-rise"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Arama satırı */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Komut, sembol veya şirket ara…"
            className="flex-1 bg-transparent text-[14px] text-slate-900 dark:text-white placeholder:text-muted-foreground focus:outline-none"
          />
          {loadingCompanies && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Kapat"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sonuç listesi */}
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
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && (
                      <span className="rounded border border-border bg-slate-100 dark:bg-[#1A243F] px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                        {c.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && !loadingCompanies && (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              Sonuç yok.
            </div>
          )}
        </div>

        {/* Alt bar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10.5px] text-muted-foreground">
          <span>
            {q.trim()
              ? `"${q.trim()}" için ${filtered.length} sonuç`
              : "Komut paleti"}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-slate-100 dark:bg-[#1A243F] px-1 py-px font-mono text-[10px]">
              ↑↓
            </kbd>
            gez ·
            <kbd className="rounded border border-border bg-slate-100 dark:bg-[#1A243F] px-1 py-px font-mono text-[10px]">
              ⏎
            </kbd>
            seç ·
            <kbd className="rounded border border-border bg-slate-100 dark:bg-[#1A243F] px-1 py-px font-mono text-[10px]">
              ESC
            </kbd>
            kapat
          </span>
        </div>
      </div>
    </div>
  );
}
