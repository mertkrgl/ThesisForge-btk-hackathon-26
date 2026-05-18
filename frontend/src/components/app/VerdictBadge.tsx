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
  /** Yanına info ikonu + tıklanınca açıklama popover'ı koy. False → sade badge. */
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
    <div ref={ref} className="relative inline-flex items-center gap-1">
      {badge}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-text-2"
        aria-label="Sentiment etiketi nedir?"
        aria-expanded={open}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[300px] rounded-xl border border-border bg-card/95 p-3.5 text-[12px] leading-relaxed text-text-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur"
        >
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Sentiment etiketi
          </div>
          <p className="text-slate-900 dark:text-white">
            <span className="font-semibold">{label}</span> ·{" "}
            {DESCRIPTION[verdict]}
          </p>
          <div className="mt-2 border-t border-border pt-2">
            <p>
              Bull ve bear maddelerinin <span className="font-mono">0–10</span>{" "}
              arası skor toplamlarından türetilir. Eşik <span className="font-mono">±6</span>:
              {" "}<span className="text-bull">+6 ve üzeri POZITIF</span>,
              {" "}<span className="text-bear">−6 ve altı NEGATIF</span>,
              {" "}arası <span className="text-warn">NÖTR</span>.
            </p>
            <p className="mt-2 text-muted-foreground">
              Güven skoru bu argümanların ne kadar sağlam veriye dayandığını
              ölçer. İki ölçü <span className="font-semibold text-text-2">birbirinden bağımsızdır</span>:
              {" "}güçlü kanıtla NEGATIF, zayıf kanıtla POZITIF olabilir.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
