"use client";

import { Download, FileText } from "lucide-react";
import { API_BASE_URL } from "@/lib/api/client";
import type { Source, Thesis, ThesisPoint } from "@/lib/mock/types";

function sourceMap(sources: Source[]) {
  return new Map(sources.map((source) => [source.id, source]));
}

function sourceMarkdown(id: string, sourcesById: Map<string, Source>) {
  const source = sourcesById.get(id);
  if (!source?.url) return `[${id}]`;
  return `[${id}](${source.url})`;
}

function formatPointsMarkdown(
  title: string,
  points: ThesisPoint[],
  sourcesById: Map<string, Source>
) {
  const rows =
    points.length > 0
      ? points
          .map((point) => {
            const refs = point.sources
              .map((id) => sourceMarkdown(id, sourcesById))
              .join(" ");
            return `- ${point.text}${refs ? ` ${refs}` : ""}`;
          })
          .join("\n")
      : "- Bu kategoride argüman yok.";

  return `## ${title}\n${rows}`;
}

function buildMarkdown(thesis: Thesis, date: string) {
  const sourcesById = sourceMap(thesis.sources);
  const kpis = thesis.kpis
    .map((kpi) => `- ${kpi.label}: ${kpi.value}${kpi.delta ? ` (${kpi.delta})` : ""}`)
    .join("\n");
  const agents = thesis.agents
    .map((agent) => `- ${agent.id}: ${agent.summary} (${agent.confidence}%)`)
    .join("\n");
  const sources = thesis.sources
    .map((source) => {
      const href = source.url ? ` - ${source.url}` : "";
      return `- [${source.id}] ${source.label}${href}`;
    })
    .join("\n");

  return [
    `# ${thesis.ticker} Yatırım Tezi`,
    "",
    `**Şirket:** ${thesis.company}`,
    `**Sektör:** ${thesis.sector}`,
    `**Tarih:** ${date}`,
    `**Karar:** ${thesis.verdict}`,
    `**Güven Skoru:** ${thesis.confidence}%`,
    "",
    thesis.oneLiner,
    "",
    "## KPI",
    kpis,
    "",
    formatPointsMarkdown("Bull", thesis.bull, sourcesById),
    "",
    formatPointsMarkdown("Bear", thesis.bear, sourcesById),
    "",
    formatPointsMarkdown("Katalist", thesis.catalysts, sourcesById),
    "",
    "## Ajan Kırılımı",
    agents,
    "",
    "## Kaynaklar",
    sources,
    "",
    "> Yatırım tavsiyesi değildir. Kaynak linkleri üretim anındaki referansları gösterir.",
  ].join("\n");
}

function downloadMarkdown(thesis: Thesis, date: string) {
  const markdown = buildMarkdown(thesis, date);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${thesis.ticker.toLowerCase()}-tez.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPdfPrint(thesis: Thesis) {
  // Server-side weasyprint render: GET /api/thesis/{id}/pdf doğrudan PDF döner.
  // Tarayıcı print sheet'i pop-up engelleyici / stil senkronu nedeniyle bazen
  // boş PDF üretiyordu; server tarafında deterministik bytes geliyor.
  const url = `${API_BASE_URL}/api/thesis/${thesis.id}/pdf`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ThesisExportButtons({
  thesis,
  date,
}: {
  thesis: Thesis;
  date: string;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => downloadMarkdown(thesis, date)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 text-[12px] text-text-2 transition-colors hover:border-border hover:text-white"
      >
        <FileText className="h-3.5 w-3.5" />
        Markdown
      </button>
      <button
        type="button"
        onClick={() => openPdfPrint(thesis)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 text-[12px] text-text-2 transition-colors hover:border-border hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        PDF
      </button>
    </div>
  );
}
