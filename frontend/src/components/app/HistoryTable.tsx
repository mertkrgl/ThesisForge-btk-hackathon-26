"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Thesis, Verdict } from "@/lib/mock/types";
import { VerdictBadge } from "./VerdictBadge";
import { cn } from "@/lib/utils";

const FILTERS: { id: Verdict | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "bull", label: "Pozitif" },
  { id: "neutral", label: "Nötr" },
  { id: "bear", label: "Negatif" },
];

export function HistoryTable({ theses }: { theses: Thesis[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Verdict | "all">("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return theses.filter((t) => {
      if (filter !== "all" && t.verdict !== filter) return false;
      if (!needle) return true;
      return (
        t.ticker.toLowerCase().includes(needle) ||
        t.company.toLowerCase().includes(needle) ||
        t.sector.toLowerCase().includes(needle)
      );
    });
  }, [theses, q, filter]);

  return (
    <div
      data-tour="history-table"
      className="rounded-2xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex w-[280px] items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[13px] focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sembol, şirket veya sektör…"
            className="flex-1 bg-transparent text-text-2 placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                filter === f.id
                  ? "border-primary/40 bg-primary/10 text-blue-700 dark:text-white"
                  : "border-slate-200 dark:border-border bg-card dark:bg-accent/50 text-slate-600 dark:text-text-2 hover:border-slate-300 dark:hover:border-border hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11.5px] text-muted-foreground">
          {rows.length} tez
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Sembol</th>
              <th className="px-4 py-2 font-semibold">Sektör</th>
              <th className="px-4 py-2 font-semibold">Karar</th>
              <th className="px-4 py-2 font-semibold">Güven</th>
              <th className="px-4 py-2 font-semibold">Tarih</th>
              <th className="px-4 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="border-b border-border/60 transition-colors hover:bg-accent/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/app/thesis/${t.id}`}
                    className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white hover:text-primary"
                  >
                    {t.ticker}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {t.company}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-2">{t.sector}</td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={t.verdict} showInfo={false} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-[80px] overflow-hidden rounded-full bg-line/60">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#3B82F6,#A78BFA,#22D3EE)]"
                        style={{ width: `${t.confidence}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11.5px] font-semibold text-slate-900 dark:text-white">
                      {t.confidence}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/app/thesis/${t.id}`}
                    className="text-[11.5px] text-primary hover:text-primary/80 dark:hover:text-white"
                  >
                    Aç →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[12.5px] text-muted-foreground"
                >
                  Filtreye uyan tez yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
