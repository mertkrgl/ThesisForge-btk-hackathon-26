import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listThesesPage } from "@/lib/api/thesis";
import { HistoryTable } from "@/components/app/HistoryTable";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";
import type { Thesis } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; page?: string }>;
}) {
  const { ticker, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let items: Thesis[] = [];
  let total = 0;
  try {
    const res = await listThesesPage({
      ticker,
      limit: PAGE_SIZE,
      offset,
    });
    items = res.items;
    total = res.total;
  } catch {
    items = [];
    total = 0;
  }

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
              Üretilen her tez burada arşivlenir. Filtreleyin, arayın veya
              görüntüleyin.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <HistoryTable theses={items} />
        </FadeIn>
        {totalPages > 1 && (
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
  // Sayfa numaralarını sıkıştır: 1 … (p-1) p (p+1) … N
  const pages: (number | "…")[] = [];
  const push = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };
  push(1);
  if (page - 1 > 2) pages.push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
    push(i);
  }
  if (page + 1 < totalPages - 1) pages.push("…");
  if (totalPages > 1) push(totalPages);

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      aria-label="Tez sayfaları"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="text-[12px] text-muted-foreground">
        Toplam <span className="font-semibold text-text-2">{total}</span> tez ·
        sayfa{" "}
        <span className="font-semibold text-text-2">
          {page} / {totalPages}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <PaginationLink
          href={buildHref(prev)}
          disabled={page === 1}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </PaginationLink>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-[12px] text-muted-foreground"
            >
              …
            </span>
          ) : (
            <PaginationLink
              key={p}
              href={buildHref(p)}
              active={p === page}
            >
              {p}
            </PaginationLink>
          ),
        )}
        <PaginationLink
          href={buildHref(next)}
          disabled={page === totalPages}
          aria-label="Sonraki sayfa"
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
  ...rest
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const base = cn(
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-[12.5px] font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-text-2 hover:border-primary/40 hover:text-primary",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={base} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={base} {...rest}>
      {children}
    </Link>
  );
}
