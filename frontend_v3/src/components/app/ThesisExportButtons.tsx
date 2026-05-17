"use client";

import { Download, FileText } from "lucide-react";
import type { Source, Thesis, ThesisPoint } from "@/lib/mock/types";

function sourceMap(sources: Source[]) {
  return new Map(sources.map((source) => [source.id, source]));
}

function sourceMarkdown(id: string, sourcesById: Map<string, Source>) {
  const source = sourcesById.get(id);
  if (!source?.url) return `[${id}]`;
  return `[${id}](${source.url})`;
}

function sourceHtml(id: string, sourcesById: Map<string, Source>) {
  const source = sourcesById.get(id);
  if (!source?.url) return `<span>[${escapeHtml(id)}]</span>`;
  return `<a href="${escapeAttribute(source.url)}">[${escapeHtml(id)}]</a>`;
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

function formatPointsHtml(
  title: string,
  points: ThesisPoint[],
  sourcesById: Map<string, Source>
) {
  const rows =
    points.length > 0
      ? points
          .map((point) => {
            const refs = point.sources
              .map((id) => sourceHtml(id, sourcesById))
              .join(" ");
            return `<li>${escapeHtml(point.text)}${refs ? ` <span class="refs">${refs}</span>` : ""}</li>`;
          })
          .join("")
      : "<li>Bu kategoride argüman yok.</li>";

  return `<section><h2>${escapeHtml(title)}</h2><ul>${rows}</ul></section>`;
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

function buildPrintHtml(thesis: Thesis, date: string) {
  const sourcesById = sourceMap(thesis.sources);
  const kpis = thesis.kpis
    .map(
      (kpi) =>
        `<li><strong>${escapeHtml(kpi.label)}:</strong> ${escapeHtml(kpi.value)}${
          kpi.delta ? ` <span>${escapeHtml(kpi.delta)}</span>` : ""
        }</li>`
    )
    .join("");
  const agents = thesis.agents
    .map(
      (agent) =>
        `<li><strong>${escapeHtml(agent.id)}:</strong> ${escapeHtml(agent.summary)} <span>(${agent.confidence}%)</span></li>`
    )
    .join("");
  const sources = thesis.sources
    .map((source) => {
      const url = source.url ?? "";
      const link = url
        ? `<a href="${escapeAttribute(url)}">${escapeHtml(url)}</a>`
        : "<span>Link yok</span>";
      return `<li><strong>[${escapeHtml(source.id)}]</strong> ${escapeHtml(source.label)}<br/><small>${link}</small></li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(thesis.ticker)} Yatırım Tezi</title>
  <style>
    body { color: #0f172a; font-family: Arial, sans-serif; line-height: 1.55; margin: 40px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { border-bottom: 1px solid #e2e8f0; font-size: 17px; margin-top: 26px; padding-bottom: 6px; }
    .meta, small { color: #475569; }
    a { color: #1d4ed8; word-break: break-all; }
    li { margin: 8px 0; }
    .refs a, .refs span { font-family: monospace; font-size: 12px; margin-left: 4px; }
    @media print { body { margin: 24px; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">PDF olarak kaydet</button>
  <h1>${escapeHtml(thesis.ticker)} Yatırım Tezi</h1>
  <div class="meta">${escapeHtml(thesis.company)} · ${escapeHtml(thesis.sector)} · ${escapeHtml(date)}</div>
  <p><strong>Karar:</strong> ${escapeHtml(thesis.verdict)} · <strong>Güven:</strong> ${thesis.confidence}%</p>
  <p>${escapeHtml(thesis.oneLiner)}</p>
  <section><h2>KPI</h2><ul>${kpis}</ul></section>
  ${formatPointsHtml("Bull", thesis.bull, sourcesById)}
  ${formatPointsHtml("Bear", thesis.bear, sourcesById)}
  ${formatPointsHtml("Katalist", thesis.catalysts, sourcesById)}
  <section><h2>Ajan Kırılımı</h2><ul>${agents}</ul></section>
  <section><h2>Kaynaklar</h2><ul>${sources}</ul></section>
  <p class="meta">Yatırım tavsiyesi değildir. Kaynak linkleri üretim anındaki referansları gösterir.</p>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
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

function openPdfPrint(thesis: Thesis, date: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(buildPrintHtml(thesis, date));
  printWindow.document.close();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
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
        onClick={() => openPdfPrint(thesis, date)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 text-[12px] text-text-2 transition-colors hover:border-border hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        PDF
      </button>
    </div>
  );
}
