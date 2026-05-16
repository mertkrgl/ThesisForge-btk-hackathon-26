"use client";

import { useRef, useState } from "react";
import { Bell, CheckCheck, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { cn } from "@/lib/utils";

const NOTIFS = [
  {
    id: "n1",
    icon: Sparkles,
    title: "Yeni tez hazır",
    body: "TUPRS için sentez ajanı %67 güvenle bir tez ürettı.",
    when: "2 dk önce",
    tone: "primary" as const,
    unread: true,
  },
  {
    id: "n2",
    icon: TrendingUp,
    title: "Watchlist hareketi",
    body: "ASELS +%3.2 ile günü tamamladı.",
    when: "18 dk önce",
    tone: "bull" as const,
    unread: true,
  },
  {
    id: "n3",
    icon: AlertTriangle,
    title: "Risk uyarısı",
    body: "EREGL volatilitesi 30 günlük ortalamasının üzerinde.",
    when: "1 saat önce",
    tone: "warn" as const,
    unread: false,
  },
];

const TONE: Record<string, string> = {
  primary: "text-[#93C5FD] bg-primary/10 border-primary/30",
  bull: "text-[#86EFAC] bg-bull/10 border-bull/30",
  warn: "text-warn bg-warn/10 border-warn/30",
};

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const unread = NOTIFS.filter((n) => n.unread).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-[34px] w-[34px] place-items-center rounded-lg border border-line bg-slate-50 text-dim transition-all hover:border-line-2 hover:text-slate-900"
        aria-label="Bildirimler"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-background bg-bear px-1 font-mono text-[9px] font-bold text-slate-900">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] overflow-hidden rounded-xl border border-line bg-white/95 shadow-xl glass-strong tf-rise">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13px] font-semibold text-slate-900">
              Bildirimler
            </span>
            <button className="inline-flex items-center gap-1 text-[11px] text-text-2 transition-colors hover:text-slate-900">
              <CheckCheck className="h-3 w-3" />
              Tümünü okundu işaretle
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {NOTIFS.map((n) => {
              const Icon = n.icon;
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b border-line/60 px-4 py-3 transition-colors hover:bg-slate-50",
                    n.unread && "bg-blue-50/50"
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                      TONE[n.tone]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-slate-900">
                        {n.title}
                      </span>
                      {n.unread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-text-2">
                      {n.body}
                    </p>
                    <span className="mt-1 inline-block text-[10.5px] text-muted-foreground">
                      {n.when}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
