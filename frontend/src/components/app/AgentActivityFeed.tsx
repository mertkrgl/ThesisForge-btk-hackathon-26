"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { listThesesPage } from "@/lib/api/thesis";
import { squadLabel } from "@/lib/data/squadLabels";
import { cn } from "@/lib/utils";
import type { AgentTone } from "@/lib/mock/types";
import type { Thesis } from "@/lib/mock/types";

const REFRESH_MS = 30_000;

type FeedRow = {
  key: string;
  agentId: string;
  action: string;
  timeAgo: string;
  confidence: number | null;
};

const TONE_DOT: Record<AgentTone, string> = {
  bull: "bg-bull",
  bear: "bg-bear",
  warn: "bg-warn",
  violet: "bg-violet",
  cyan: "bg-cyan",
  primary: "bg-primary",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.floor(hours / 24)} gün`;
}

function thesisToRows(thesis: Thesis): FeedRow[] {
  const rows: FeedRow[] = [];
  const date = thesis.createdAt;

  // Sektör yönlendirici
  rows.push({
    key: `${thesis.id}-sector`,
    agentId: "sector-router",
    action: `${thesis.ticker} → ${thesis.sector} squad'ına atandı`,
    timeAgo: timeAgo(date),
    confidence: null,
  });

  // Ajan bazlı satırlar (thesis.agents dizisinden)
  const agentOrder: Array<{ id: string; suffix: string }> = [
    { id: "macro", suffix: "makro bağlam değerlendi" },
    { id: "memory", suffix: "tarihsel benzerlik tarandı" },
    { id: "technical", suffix: "teknik analiz tamamlandı" },
    { id: "fundamental", suffix: "temel analiz tamamlandı" },
    { id: "devils-advocate", suffix: "karşıt argümanlar üretildi" },
  ];

  for (const { id, suffix } of agentOrder) {
    const agentData = thesis.agents.find((a) => a.id === id);
    if (!agentData) continue;
    rows.push({
      key: `${thesis.id}-${id}`,
      agentId: id,
      action: `${thesis.ticker} — ${suffix}`,
      timeAgo: timeAgo(date),
      confidence: agentData.confidence ?? null,
    });
  }

  // Sentez
  const label =
    thesis.sentimentLabel === "POZITIF"
      ? "ALIM"
      : thesis.sentimentLabel === "NEGATIF"
        ? "SATIM"
        : "NÖTR";

  rows.push({
    key: `${thesis.id}-synth`,
    agentId: "synthesizer",
    action: `${thesis.ticker} sentezi yayınlandı — ${label}`,
    timeAgo: timeAgo(date),
    confidence: thesis.confidence,
  });

  return rows;
}

export function AgentActivityFeed() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    try {
      const page = await listThesesPage({ limit: 3, offset: 0 });
      const feed: FeedRow[] = [];
      for (const thesis of page.items) {
        feed.push(...thesisToRows(thesis));
      }
      // En son thesis en üstte; her thesis içindeki sıra korunur
      setRows(feed);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("Veriler alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayRows = rows.slice(0, 10);

  return (
    <div className="h-full flex flex-col rounded-2xl border border-border bg-card p-4">
      {/* Başlık */}
      <div className="mb-3 flex items-center justify-between shrink-0">
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          Ajan Aktivitesi
        </h2>
        <div className="flex items-center gap-2">
          {loading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!loading && lastUpdated && (
            <button
              type="button"
              onClick={() => { setLoading(true); load(); }}
              title="Yenile"
              className="text-muted-foreground transition-colors hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <span className="text-[11px] text-muted-foreground">
            {lastUpdated
              ? `${lastUpdated.getHours().toString().padStart(2, "0")}:${lastUpdated.getMinutes().toString().padStart(2, "0")} güncellendi`
              : "yükleniyor…"}
          </span>
        </div>
      </div>

      {/* İçerik */}
      {error ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
          {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <ul className="flex flex-col gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <li
              key={i}
              className="h-[28px] animate-pulse rounded-lg bg-muted/40"
            />
          ))}
        </ul>
      ) : displayRows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
          Henüz tez bulunmuyor.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {displayRows.map((row) => {
            const meta = AGENT_REGISTRY.find((a) => a.id === row.agentId);
            if (!meta) return null;
            return (
              <li
                key={row.key}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    TONE_DOT[meta.tone],
                  )}
                />
                <span className="shrink-0 text-[11.5px] font-semibold text-slate-900 dark:text-white">
                  {meta.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-2">
                  {row.action}
                </span>
                {row.confidence !== null && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    %{Math.round(row.confidence)}
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {row.timeAgo}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
