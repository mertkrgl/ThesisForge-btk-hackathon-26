"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { deleteThesis, fetchThesisPdf } from "@/lib/api/thesis";
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
  downloadBlob(blob, `${thesis.ticker.toLowerCase()}-tez.md`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ThesisExportButtons({
  thesis,
  date,
}: {
  thesis: Thesis;
  date: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    const ok = window.confirm(
      `${thesis.ticker} tezini kalıcı olarak silmek istediğine emin misin?`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteThesis(thesis.id);
      router.push("/app/history?deleted=1");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Tez silinemedi. Lütfen tekrar deneyin.";
      window.alert(
        msg.includes("bulunamad")
          ? "Bu tez silinemedi. Tez başka bir hesaba ait olabilir veya daha önce silinmiş olabilir."
          : msg,
      );
    } finally {
      setDeleting(false);
    }
  };

  const handlePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await fetchThesisPdf(thesis.id);
      downloadBlob(blob, `${thesis.ticker.toLowerCase()}-tez.pdf`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "PDF açılamadı.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
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
          onClick={handlePdf}
          disabled={pdfBusy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3 text-[12px] text-text-2 transition-colors hover:border-border hover:text-white"
        >
          {pdfBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          PDF
        </button>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-bear/30 bg-bear/10 px-3 text-[11.5px] font-medium text-bear transition-colors hover:bg-bear/15 disabled:opacity-60"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Tezi Sil
      </button>
    </div>
  );
}
