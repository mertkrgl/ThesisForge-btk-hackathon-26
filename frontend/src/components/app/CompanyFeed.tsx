"use client";

import * as React from "react";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Newspaper,
  Paperclip,
  RefreshCcw,
} from "lucide-react";
import { fetchCompanyFeed } from "@/lib/api/market";
import { cn } from "@/lib/utils";
import type {
  BackendCompanyFeed,
  BackendFeedItem,
} from "@/lib/types/backend";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relativeFormatter = new Intl.RelativeTimeFormat("tr-TR", {
  numeric: "auto",
});

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relativeFormatter.format(diffSec, "second");
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86_400 * 30)
    return relativeFormatter.format(Math.round(diffSec / 86_400), "day");
  if (abs < 86_400 * 365)
    return relativeFormatter.format(Math.round(diffSec / (86_400 * 30)), "month");
  return relativeFormatter.format(Math.round(diffSec / (86_400 * 365)), "year");
}

type FeedFilter = "all" | "kap" | "news";

export function CompanyFeed({ ticker }: { ticker: string }) {
  const [data, setData] = React.useState<BackendCompanyFeed | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const [filter, setFilter] = React.useState<FeedFilter>("all");
  const loading = !error && data == null;

  const counts = React.useMemo(() => {
    if (!data) return { all: 0, kap: 0, news: 0 };
    let kap = 0;
    let news = 0;
    for (const it of data.items) {
      if (it.kind === "kap") kap++;
      else news++;
    }
    return { all: data.items.length, kap, news };
  }, [data]);

  const filteredItems = React.useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.items;
    if (filter === "kap") return data.items.filter((i) => i.kind === "kap");
    return data.items.filter((i) => i.kind !== "kap");
  }, [data, filter]);

  React.useEffect(() => {
    let cancelled = false;
    fetchCompanyFeed(ticker, { days: 30, limit: 30 })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Akış alınamadı");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, retryNonce]);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Şirket Akışı
          </div>
          <h2 className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            KAP bildirimleri & haberler
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[11px] text-muted-foreground">
              son 30 gün · {data.count} kayıt
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setData(null);
              setError(null);
              setRetryNonce((n) => n + 1);
            }}
            className="rounded-md border border-border bg-card p-1.5 text-text-2 transition-colors hover:text-white"
            aria-label="Yenile"
            title="Yenile"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {loading ? (
        <ul className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="px-5 py-4">
              <div className="h-3 w-20 animate-pulse rounded bg-card/80" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-card/80" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-card/80" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <FeedEmptyState
          icon={<AlertCircle className="h-5 w-5 text-bear" />}
          title="Akış alınamadı"
          subtitle={error}
          action={
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRetryNonce((n) => n + 1);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] text-text-2 hover:text-white"
            >
              Tekrar dene
            </button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <FeedEmptyState
          icon={<Newspaper className="h-5 w-5 text-muted-foreground" />}
          title="Henüz akış yok"
          subtitle={`${ticker} için son 30 günde KAP bildirimi veya haber bulunamadı.`}
        />
      ) : (
        <>
          <FeedTabs filter={filter} counts={counts} onChange={setFilter} />
          {filteredItems.length === 0 ? (
            <FeedEmptyState
              icon={<Newspaper className="h-5 w-5 text-muted-foreground" />}
              title={
                filter === "kap"
                  ? "KAP bildirimi yok"
                  : "Haber bulunmadı"
              }
              subtitle={`${ticker} için son 30 günde ${
                filter === "kap" ? "KAP bildirimi" : "haber"
              } yok. Diğer sekmeleri deneyin.`}
            />
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((item) => (
                <FeedRow key={item.id} item={item} />
              ))}
            </ul>
          )}
          {Object.keys(data.sources_err).length > 0 && (
            <div className="border-t border-border bg-warn/5 px-5 py-2.5 text-[11px] text-warn">
              Bazı kaynaklar yüklenemedi:{" "}
              {Object.keys(data.sources_err).join(", ")}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FeedTabs({
  filter,
  counts,
  onChange,
}: {
  filter: FeedFilter;
  counts: { all: number; kap: number; news: number };
  onChange: (f: FeedFilter) => void;
}) {
  const tabs: { key: FeedFilter; label: string; count: number }[] = [
    { key: "all", label: "Tümü", count: counts.all },
    { key: "kap", label: "KAP", count: counts.kap },
    { key: "news", label: "Haberler", count: counts.news },
  ];
  return (
    <div
      role="tablist"
      aria-label="Akış filtresi"
      className="flex items-center gap-1 border-b border-border px-4 pt-2"
    >
      {tabs.map((t) => {
        const active = filter === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[12.5px] font-medium transition-colors",
              active
                ? "text-slate-900 dark:text-white"
                : "text-muted-foreground hover:text-text-2",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-px font-mono text-[10.5px]",
                active
                  ? "bg-primary/15 text-primary"
                  : "bg-card/80 text-muted-foreground",
              )}
            >
              {t.count}
            </span>
            {active && (
              <span className="absolute inset-x-1 bottom-[-1px] h-[2px] rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function FeedRow({ item }: { item: BackendFeedItem }) {
  const isKap = item.kind === "kap";
  const attachmentCount =
    typeof item.meta?.attachment_count === "number"
      ? (item.meta.attachment_count as number)
      : 0;
  const isLate = Boolean(item.meta?.is_late);
  const Icon = isKap ? FileText : Newspaper;

  const body = (
    <div className="flex gap-3 px-5 py-4 transition-colors group-hover:bg-accent/15">
      <div
        className={cn(
          "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border",
          isKap
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-violet/30 bg-violet/10 text-violet",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider",
              isKap
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-violet/30 bg-violet/10 text-violet",
            )}
          >
            {isKap ? "KAP" : "Haber"}
          </span>
          <span className="text-text-2">{item.source}</span>
          {isLate && (
            <span className="inline-flex items-center rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10.5px] font-semibold text-warn">
              Geç bildirim
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <time
            dateTime={item.published_at}
            title={dateFormatter.format(new Date(item.published_at))}
            className="text-muted-foreground"
          >
            {timeAgo(item.published_at)}
          </time>
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-[13.5px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-primary dark:text-white">
          {item.title}
        </h3>
        {item.snippet && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-text-2">
            {item.snippet}
          </p>
        )}
      </div>
      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </div>
  );

  if (!item.url) {
    return <li className="group">{body}</li>;
  }
  return (
    <li className="group">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        {body}
      </a>
    </li>
  );
}

function FeedEmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-card/60">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-medium text-slate-900 dark:text-white">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-[12px] text-text-2">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
