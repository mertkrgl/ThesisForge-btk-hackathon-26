/**
 * Synthesizer thesis_md çıktısının tam render edilmesi.
 *
 * Sadece synthesizer'ın gerçekten ürettiği markdown subset'ini destekler:
 *   - `## Başlık`, `### Alt başlık`
 *   - `- ` / `* ` bullet listeleri (çoklu boşluk toleranslı)
 *   - Paragraflar
 *   - Inline `**bold**`, `*italic*`
 *   - `[kaynak: UUID]` → SourceChip (varsa Citation tool_name'inden zengin label)
 */
import React from "react";
import { InlineMarkdown } from "@/components/shared/InlineMarkdown";
import { SourceChip } from "@/components/app/SourceChip";
import { toolToSource } from "@/lib/data/toolLabels";
import type { Source } from "@/lib/mock/types";

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const KAYNAK_INLINE_RE = /\[\s*kaynak\s*:\s*([a-f0-9-]{36})\s*\]/gi;

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let bullets: string[] | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets && bullets.length > 0) {
      blocks.push({ kind: "ul", items: bullets });
    }
    bullets = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const stripped = line.trim();
    if (!stripped) {
      flushPara();
      flushBullets();
      continue;
    }
    const h = HEADING_RE.exec(stripped);
    if (h) {
      flushPara();
      flushBullets();
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      blocks.push({ kind: "h", level, text: h[2].trim() });
      continue;
    }
    const b = BULLET_RE.exec(stripped);
    if (b) {
      flushPara();
      bullets = bullets ?? [];
      bullets.push(b[1].trim());
      continue;
    }
    flushBullets();
    para.push(stripped);
  }
  flushPara();
  flushBullets();
  return blocks;
}

function renderInline(
  text: string,
  citations?: { call_id: string; tool_name: string | null }[],
): React.ReactNode {
  // [kaynak: uuid] referanslarını ayır; aralardaki metni InlineMarkdown ile bas
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  KAYNAK_INLINE_RE.lastIndex = 0;
  while ((match = KAYNAK_INLINE_RE.exec(text)) !== null) {
    const before = text.slice(lastIdx, match.index);
    if (before) {
      parts.push(
        <InlineMarkdown key={`t${lastIdx}`} text={before.replace(/\s+$/, " ")} />,
      );
    }
    const uuid = match[1];
    const cit = citations?.find((c) => c.call_id === uuid);
    const src: Source = cit
      ? toolToSource(uuid, cit.tool_name)
      : { id: uuid, label: "Kaynak", kind: "filing" };
    parts.push(
      <SourceChip
        key={`s${match.index}`}
        source={src}
        className="ml-0.5 align-middle"
      />,
    );
    lastIdx = match.index + match[0].length;
  }
  const tail = text.slice(lastIdx);
  if (tail) parts.push(<InlineMarkdown key={`t${lastIdx}`} text={tail} />);
  return parts;
}

export function ThesisReport({
  markdown,
  citations,
}: {
  markdown: string;
  citations?: { call_id: string; tool_name: string | null }[];
}) {
  if (!markdown?.trim()) return null;
  const blocks = parseBlocks(markdown);

  return (
    <div className="thesis-report flex flex-col gap-3 text-[13.5px] leading-relaxed text-text-2">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          if (b.level === 1) {
            return (
              <h2
                key={i}
                className="mt-3 text-[18px] font-bold text-slate-900 dark:text-white"
              >
                {renderInline(b.text, citations)}
              </h2>
            );
          }
          if (b.level === 2) {
            return (
              <h3
                key={i}
                className="mt-4 border-b border-border pb-1 text-[15px] font-semibold text-slate-900 dark:text-white"
              >
                {renderInline(b.text, citations)}
              </h3>
            );
          }
          return (
            <h4
              key={i}
              className="mt-2 text-[13.5px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {renderInline(b.text, citations)}
            </h4>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="ml-4 flex list-disc flex-col gap-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="pl-1 marker:text-muted-foreground">
                  {renderInline(item, citations)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="">
            {renderInline(b.text, citations)}
          </p>
        );
      })}
    </div>
  );
}
