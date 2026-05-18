"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { listThesesPage } from "@/lib/api/thesis";
import { HistoryTable } from "@/components/app/HistoryTable";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Thesis } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function HistoryClient() {
  const searchParams = useSearchParams();
  const ticker = searchParams.get("ticker") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Thesis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!isAuthenticated) {
      queueMicrotask(() => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    listThesesPage({ ticker, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Tezler alınamadı.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, ticker, offset]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (p: number) => {
    const qs = new URLSearchParams();
    if (ticker) qs.set("ticker", ticker);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/app/history?${s}` : `/app/history`;
  };

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Arşiv
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Tezler
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              Ürettiğiniz tezler burada arşivlenir. Filtreleyin, arayın veya
              görüntüleyin.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-card text-[12px] text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Tezler yükleniyor
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-bear/30 bg-bear/10 p-5 text-[13px] text-bear">
              {error}
            </div>
          ) : !isAuthenticated ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-[13px] text-text-2">
              Tez arşivini görüntülemek için giriş yapın.
            </div>
          ) : (
            <HistoryTable theses={items} />
          )}
        </FadeIn>

        {isAuthenticated && !loading && !error && totalPages > 1 && (
          <FadeIn delay={0.15}>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              buildHref={buildHref}
            />
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  buildHref: (p: number) => string;
}) {
  const pages: (number | "...")[] = [];
  const push = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };
  push(1);
  if (page - 1 > 2) pages.push("...");
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
    push(i);
  }
  if (page + 1 < totalPages - 1) pages.push("...");
  if (totalPages > 1) push(totalPages);

  return (
    <nav
      aria-label="Tez sayfaları"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="text-[12px] text-muted-foreground">
        Toplam <span className="font-semibold text-text-2">{total}</span> tez
      </div>
      <div className="flex items-center gap-1">
        <PaginationLink href={buildHref(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </PaginationLink>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`gap-${i}`} className="px-2 text-[12px] text-muted-foreground">
              ...
            </span>
          ) : (
            <PaginationLink key={p} href={buildHref(p)} active={p === page}>
              {p}
            </PaginationLink>
          ),
        )}
        <PaginationLink
          href={buildHref(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </PaginationLink>
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base = cn(
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-[12.5px] font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-text-2 hover:border-primary/40 hover:text-primary",
    disabled && "pointer-events-none opacity-40",
  );
  return disabled ? (
    <span className={base}>{children}</span>
  ) : (
    <Link href={href} className={base}>
      {children}
    </Link>
  );
}
