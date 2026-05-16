import type { Source } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<Source["kind"], string> = {
  kap: "text-bull border-bull/30",
  evds: "text-primary border-primary/30",
  bist: "text-cyan border-cyan/30",
  mkk: "text-violet border-violet/30",
  news: "text-warn border-warn/30",
  filing: "text-bear border-bear/30",
};

export function SourceChip({
  source,
  className,
}: {
  source: Source | { id: string; label?: string; kind?: Source["kind"] };
  className?: string;
}) {
  const kind = ("kind" in source && source.kind) || "filing";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px]",
        KIND_TONE[kind],
        className
      )}
      title={"label" in source ? source.label : source.id}
    >
      <span className="opacity-60">[</span>
      {source.id}
      <span className="opacity-60">]</span>
    </span>
  );
}
