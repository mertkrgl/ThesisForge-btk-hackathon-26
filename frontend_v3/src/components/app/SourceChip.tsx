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
  source: Source | { id: string; label?: string; kind?: Source["kind"]; url?: string };
  className?: string;
}) {
  const kind = ("kind" in source && source.kind) || "filing";
  const label = "label" in source && source.label ? source.label : source.id;
  const url = "url" in source ? source.url : undefined;
  const chipClassName = cn(
    "inline-flex items-center gap-1 rounded border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px]",
    KIND_TONE[kind],
    url && "transition-colors hover:bg-accent hover:underline",
    className
  );
  const content = (
    <>
      <span className="opacity-60">[</span>
      {source.id}
      <span className="opacity-60">]</span>
    </>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={chipClassName}
        title={`${label} - kaynağı aç`}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={chipClassName} title={label}>
      {content}
    </span>
  );
}
