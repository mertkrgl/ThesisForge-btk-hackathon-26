"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { addToWatchlist } from "@/lib/api/watchlist";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export type CompanyCardData = {
  ticker: string;
  title: string;
  member_type: string;
};

export function CompanyCard({
  company,
  isFollowing = false,
}: {
  company: CompanyCardData;
  isFollowing?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "busy" | "added" | "exists">("idle");
  const [error, setError] = useState<string | null>(null);
  const effectiveStatus = isFollowing && status !== "busy" ? "exists" : status;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(
        `/login?next=${encodeURIComponent("/app/companies")}`,
      );
      return;
    }
    if (effectiveStatus === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      const res = await addToWatchlist(company.ticker);
      setStatus(res.status === "added" ? "added" : "exists");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
      setStatus("idle");
    }
  };

  const addLabel =
    effectiveStatus === "busy"
      ? "Ekleniyor…"
      : effectiveStatus === "added"
        ? "Eklendi"
        : effectiveStatus === "exists"
          ? "Takip ediliyor"
          : "Takip Et";

  const detailHref = `/app/watchlist/${company.ticker}`;
  const goDetail = () => router.push(detailHref);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={goDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDetail();
        }
      }}
      className="group flex h-full cursor-pointer flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/20 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex min-w-0 items-start gap-3">
        <CompanyLogo
          ticker={company.ticker}
          company={company.title}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[15px] font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-white dark:group-hover:text-primary">
            {company.ticker}
          </div>
          <div className="line-clamp-2 text-[12px] text-text-2">
            {company.title}
          </div>
        </div>
      </div>

      {company.member_type && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {company.member_type
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
            .slice(0, 3)
            .map((m) => (
              <span
                key={m}
                className="rounded-md border border-border bg-card/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                {m}
              </span>
            ))}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-bear/30 bg-bear/10 px-2 py-1 text-[11px] text-bear">
          {error}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Link
          href={`/app/thesis/live?symbol=${company.ticker}`}
          data-tour="company-thesis-action"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Tez Üret
        </Link>
        <button
          type="button"
          data-tour="company-watchlist-action"
          onClick={handleAdd}
          disabled={status === "busy"}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors",
            effectiveStatus === "added" || effectiveStatus === "exists"
              ? "border-bull/40 bg-bull/10 text-bull"
              : "border-border bg-card text-text-2 hover:border-primary/40 hover:text-primary",
            effectiveStatus === "busy" && "opacity-60",
          )}
          title={
            isAuthenticated
              ? "Takip listesine ekle"
              : "Giriş yapmak için tıklayın"
          }
        >
          {effectiveStatus === "busy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : effectiveStatus === "added" || effectiveStatus === "exists" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{addLabel}</span>
        </button>
      </div>
    </div>
  );
}
