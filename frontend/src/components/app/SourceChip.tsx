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

// UUID regex — kullanıcıya tam UUID basmamak için kısalt
const _UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function _displayId(id: string, label?: string): string {
  if (label) return label;
  if (_UUID_RE.test(id)) return id.slice(0, 8); // ilk 8 char yeterli unique
  return id;
}

export function SourceChip({
  source,
  className,
}: {
  source: Source | { id: string; label?: string; kind?: Source["kind"]; url?: string };
  className?: string;
}) {
  const kind = ("kind" in source && source.kind) || "filing";
  const rawLabel = "label" in source && source.label ? source.label : undefined;
  const url = "url" in source ? source.url : undefined;
  const display = _displayId(source.id, rawLabel);
  const tooltip = rawLabel ? `${rawLabel} · ${source.id}` : source.id;
  const chipClassName = cn(
    "inline-flex max-w-[260px] items-center gap-1 truncate rounded border bg-secondary px-1.5 py-0.5 text-[10.5px]",
    rawLabel ? "font-sans" : "font-mono",
    KIND_TONE[kind],
    url && "transition-colors hover:bg-accent hover:underline",
    className
  );
  const content = (
    <>
      <span className="opacity-60">[</span>
      <span className="truncate">{display}</span>
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
        title={`${tooltip} — kaynağı aç`}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={chipClassName} title={tooltip}>
      {content}
    </span>
  );
}
