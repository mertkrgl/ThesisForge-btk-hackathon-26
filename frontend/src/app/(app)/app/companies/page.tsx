"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { CompanyCard } from "@/components/app/CompanyCard";
import { listCompanies, type CompanyRow } from "@/lib/api/companies";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce arama input'u (250ms) — her tuş vuruşunda fetch atmamak için
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const offset = (page - 1) * PAGE_SIZE;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    listCompanies({ search: debounced, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Şirket listesi alınamadı");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && items.length === 0 && total === 0;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Borsa İstanbul
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Şirketler
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              BIST&apos;te işlem gören şirketlerin tamamı. Sembolle veya unvanla
              arayın, doğrudan tez başlatın.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-tour="companies-search"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="GARAN, BIM, Aselsan…"
                className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-text-2"
                  aria-label="Temizle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
              Toplam{" "}
              <span className="font-semibold text-text-2">{total}</span> şirket
            </div>
          </div>
        </FadeIn>

        {error && (
          <div className="mb-4 rounded-lg border border-bear/30 bg-bear/10 p-3 text-[13px] text-bear">
            {error}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              compact
              onChange={(p) => {
                setPage(p);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
          </div>
        )}

        {firstLoad ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-[180px] animate-pulse rounded-2xl border border-border bg-card/60"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-[14px] text-text-2">
              {debounced
                ? `"${debounced}" için sonuç bulunamadı.`
                : "Şirket listesi boş."}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
              loading && "opacity-60",
            )}
          >
            {items.map((c) => (
              <CompanyCard key={c.ticker} company={c} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onChange={(p) => {
              setPage(p);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
  compact,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
  compact?: boolean;
}) {
  const pages = useMemo<(number | "…")[]>(() => {
    const out: (number | "…")[] = [];
    const push = (n: number) => {
      if (!out.includes(n)) out.push(n);
    };
    push(1);
    if (page - 1 > 2) out.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      push(i);
    }
    if (page + 1 < totalPages - 1) out.push("…");
    if (totalPages > 1) push(totalPages);
    return out;
  }, [page, totalPages]);

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      aria-label="Şirket sayfaları"
      className={cn(
        "flex flex-wrap items-center gap-3",
        compact ? "justify-end" : "mt-6 justify-between",
      )}
    >
      {!compact && (
        <div className="text-[12px] text-muted-foreground">
          Toplam <span className="font-semibold text-text-2">{total}</span>{" "}
          şirket · sayfa{" "}
          <span className="font-semibold text-text-2">
            {page} / {totalPages}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <PageBtn
          onClick={() => onChange(prev)}
          disabled={page === 1}
          ariaLabel="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-[12px] text-muted-foreground"
            >
              …
            </span>
          ) : (
            <PageBtn
              key={p}
              onClick={() => onChange(p)}
              active={p === page}
            >
              {p}
            </PageBtn>
          ),
        )}
        <PageBtn
          onClick={() => onChange(next)}
          disabled={page === totalPages}
          ariaLabel="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </PageBtn>
      </div>
    </nav>
  );
}

function PageBtn({
  onClick,
  active,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-[12.5px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-text-2 hover:border-primary/40 hover:text-primary",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}
