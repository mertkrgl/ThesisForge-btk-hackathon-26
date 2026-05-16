import Link from "next/link";
import type { Thesis } from "@/lib/mock/types";
import { VerdictBadge } from "./VerdictBadge";

export function ThesisCard({ thesis }: { thesis: Thesis }) {
  const date = new Date(thesis.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
  return (
    <Link
      href={`/app/thesis/${thesis.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-[0_20px_40px_-20px_rgba(59,130,246,0.35)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] font-bold text-slate-900 dark:text-white">
            {thesis.ticker}
          </span>
          <VerdictBadge verdict={thesis.verdict} />
        </div>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {date}
        </span>
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">
        {thesis.sector}
      </div>
      <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-text-2">
        {thesis.oneLiner}
      </p>
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="uppercase tracking-[0.14em] text-muted-foreground">
            güven
          </span>
          <span className="font-mono text-[12px] font-semibold text-slate-900 dark:text-white">
            {thesis.confidence}%
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#3B82F6,#A78BFA,#22D3EE)]"
            style={{ width: `${thesis.confidence}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
