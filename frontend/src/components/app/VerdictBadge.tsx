"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import type { Verdict } from "@/lib/mock/types";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { cn } from "@/lib/utils";

const MAP: Record<
  Verdict,
  { label: string; cls: string; dot: string }
> = {
  bull: {
    label: "POZITIF",
    cls: "bg-bull/15 text-bull border-bull/30",
    dot: "bg-bull",
  },
  bear: {
    label: "NEGATIF",
    cls: "bg-bear/15 text-bear border-bear/30",
    dot: "bg-bear",
  },
  neutral: {
    label: "NÖTR",
    cls: "bg-warn/15 text-warn border-warn/30",
    dot: "bg-warn",
  },
};

const DESCRIPTION: Record<Verdict, string> = {
  bull: "Boğa argümanları toplam skoru, ayı argümanlarından belirgin ölçüde yüksek.",
  bear: "Ayı argümanları toplam skoru, boğa argümanlarından belirgin ölçüde yüksek.",
  neutral: "Boğa ve ayı argümanları dengede veya argüman skorları yeterince güçlü değil.",
};

export function VerdictBadge({
  verdict,
  className,
  showInfo = true,
}: {
  verdict: Verdict;
  className?: string;
  showInfo?: boolean;
}) {
  const { label, cls, dot } = MAP[verdict];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider",
        cls,
        className,
      )}
      title={DESCRIPTION[verdict]}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );

  if (!showInfo) return badge;

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1.5">
      {badge}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-5 w-5 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-text-2"
        aria-label="Sentiment etiketi nedir?"
        aria-expanded={open}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+10px)] z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover p-4 text-[12.5px] leading-relaxed text-text-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Sentiment Etiketi
          </div>
          <p className="text-slate-900 dark:text-white">
            <span className="font-semibold">{label}</span>: {DESCRIPTION[verdict]}
          </p>
          <div className="mt-3 border-t border-border pt-3">
            <p>
              Bull ve bear maddelerinin <span className="font-mono">0-10</span> arası skor
              toplamlarından türetilir. Eşik <span className="font-mono">±6</span>: {" "}
              <span className="text-bull">+6 ve üzeri POZITIF</span>, {" "}
              <span className="text-bear">-6 ve altı NEGATIF</span>, arası {" "}
              <span className="text-warn">NÖTR</span>.
            </p>
            <p className="mt-2 text-muted-foreground">
              Güven skoru argümanların veri kalitesini ölçer; sentiment sonucu ile birebir aynı şey değildir.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
