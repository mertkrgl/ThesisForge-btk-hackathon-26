"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeTool } from "@/lib/data/toolResultFormatters";
import type { CitationDetail, Source } from "@/lib/mock/types";

const KIND_TONE: Record<Source["kind"], string> = {
  kap: "text-bull border-bull/30",
  evds: "text-primary border-primary/30",
  bist: "text-cyan border-cyan/30",
  mkk: "text-violet border-violet/30",
  news: "text-warn border-warn/30",
  filing: "text-bear border-bear/30",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFetchedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormatter.format(d);
}

export function SourceChipPopover({
  citation,
  source,
  className,
}: {
  citation: CitationDetail | null;
  source: Source;
  className?: string;
}) {
  const tone = KIND_TONE[source.kind] ?? KIND_TONE.filing;
  const chipLabel = source.label ?? source.id.slice(0, 8);

  // Citation yoksa (kaynaksız claim) sade chip, popover yok.
  if (!citation || !citation.tool_name) {
    return (
      <span
        className={cn(
          "inline-flex max-w-[260px] items-center gap-1 truncate rounded border bg-secondary px-1.5 py-0.5 text-[10.5px]",
          source.label ? "font-sans" : "font-mono",
          tone,
          className,
        )}
        title={source.id}
      >
        <span className="opacity-60">[</span>
        <span className="truncate">{chipLabel}</span>
        <span className="opacity-60">]</span>
      </span>
    );
  }

  const detail = describeTool(citation);
  const fetched = formatFetchedAt(detail.fetchedAt);

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "inline-flex max-w-[260px] items-center gap-1 truncate rounded border bg-secondary px-1.5 py-0.5 text-[10.5px] align-middle transition-colors cursor-pointer hover:bg-accent",
          source.label ? "font-sans" : "font-mono",
          tone,
          "data-[popup-open]:bg-accent data-[popup-open]:ring-1 data-[popup-open]:ring-primary/40",
          className,
        )}
        aria-label={`Kaynak detayı: ${detail.label}`}
      >
        <span className="opacity-60">[</span>
        <span className="truncate">{chipLabel}</span>
        <span className="opacity-60">]</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup
            className={cn(
              "z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Popover.Title className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {detail.label}
                  </Popover.Title>
                  {citation.tool_name && (
                    <code className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">
                      {citation.tool_name}
                      {detail.args ? `(${detail.args})` : "()"}
                    </code>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-2">
                  {source.kind}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {detail.source && (
                  <span>
                    Veri sağlayıcı:{" "}
                    <span className="font-mono text-text-2">{detail.source}</span>
                  </span>
                )}
                {fetched && <span>Çekildi: {fetched}</span>}
              </div>
            </div>

            {detail.fields.length > 0 && (
              <div className="max-h-[240px] overflow-y-auto px-4 py-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                  {detail.fields.map((f, i) => (
                    <React.Fragment key={`${f.label}-${i}`}>
                      <dt className="truncate text-muted-foreground">{f.label}</dt>
                      <dd className="truncate text-right font-mono text-slate-900 dark:text-white">
                        {f.value}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            )}

            {detail.externalUrl && (
              <div className="border-t border-border bg-card/60 px-4 py-2.5">
                <a
                  href={detail.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {detail.externalLabel ?? "Kaynağı aç"}
                </a>
              </div>
            )}

            <div className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
              call_id: {citation.call_id.slice(0, 8)}…
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
