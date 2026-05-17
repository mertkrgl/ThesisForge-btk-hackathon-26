/**
 * Hafif inline markdown render — `**bold**` ve `*italic*` desteği.
 *
 * Synthesizer çıktısı bull/bear/catalyst bullet'larında `**etiket:** açıklama`
 * formatı kullanıyor. Tam bir markdown parser'a (react-markdown) gerek yok;
 * sadece inline emphasis lazım.
 */
import React from "react";

const TOKEN_RE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

export function InlineMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (
          (part.startsWith("**") && part.endsWith("**")) ||
          (part.startsWith("__") && part.endsWith("__"))
        ) {
          return (
            <strong key={i} className="font-semibold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (
          (part.startsWith("*") && part.endsWith("*")) ||
          (part.startsWith("_") && part.endsWith("_"))
        ) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
