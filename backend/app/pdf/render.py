"""Thesis markdown → PDF (weasyprint).

Tarayıcı `window.print()` sheet'i pop-up blocker veya stil senkronu nedeniyle
zaman zaman boş PDF üretiyordu. Sunucu tarafında deterministik render:
  1. markdown → HTML (markdown.Markdown extensions: extra, sane_lists)
  2. `[kaynak: <uuid>]` etiketleri citations map'i ile `<a>` veya `<span>`'e dönüştür
  3. weasyprint ile HTML → PDF bytes
"""
from __future__ import annotations

import re
from datetime import datetime
from html import escape
from typing import Any

import markdown as md_lib


_UUID_RE = re.compile(r"\[\s*kaynak\s*:\s*([a-f0-9-]{36})\s*\]", re.IGNORECASE)


# ───────────────────────── HTML template ─────────────────────────


_CSS = """
@page { size: A4; margin: 22mm 18mm; }
* { box-sizing: border-box; }
body {
  color: #0f172a;
  font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 11.5pt;
  line-height: 1.55;
}
header {
  border-bottom: 2px solid #2563eb;
  padding-bottom: 10px;
  margin-bottom: 18px;
}
header .ticker {
  font-family: "SF Mono", Menlo, monospace;
  font-size: 26pt;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #0f172a;
}
header .meta {
  margin-top: 4px;
  color: #475569;
  font-size: 10pt;
}
header .badges {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
header .badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 9pt;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  color: #334155;
}
header .badge.confidence {
  border-color: #22c55e;
  color: #15803d;
  background: #f0fdf4;
}
header .badge.persona {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}
header .badge.warn {
  border-color: #f59e0b;
  color: #b45309;
  background: #fffbeb;
}
h1 { font-size: 18pt; margin: 18px 0 8px; color: #0f172a; }
h2 { font-size: 14pt; margin: 18px 0 6px; padding-bottom: 4px;
     border-bottom: 1px solid #e2e8f0; color: #0f172a; }
h3 { font-size: 12pt; margin: 14px 0 4px; color: #0f172a; }
p { margin: 6px 0; }
ul { margin: 6px 0 10px; padding-left: 22px; }
li { margin: 3px 0; }
strong { color: #0f172a; }
a { color: #1d4ed8; text-decoration: none; }
a:hover { text-decoration: underline; }
.kaynak {
  display: inline-block;
  margin-left: 3px;
  padding: 1px 6px;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  background: #eff6ff;
  color: #1d4ed8;
  font-family: "SF Mono", Menlo, monospace;
  font-size: 8.5pt;
  font-weight: 600;
  text-decoration: none;
}
.kaynak.missing {
  border-color: #fcd34d;
  background: #fef3c7;
  color: #b45309;
}
.disclaimer {
  margin-top: 26px;
  padding: 10px 14px;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  border-radius: 8px;
  color: #78350f;
  font-size: 9.5pt;
  line-height: 1.5;
}
.sources {
  margin-top: 22px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}
.sources h2 { border: none; margin-top: 0; }
.sources ol { padding-left: 20px; font-size: 10pt; color: #334155; }
.sources li { margin: 4px 0; }
.sources .lbl { font-weight: 600; color: #0f172a; }
.sources .url {
  color: #1d4ed8;
  font-family: "SF Mono", Menlo, monospace;
  font-size: 9pt;
  word-break: break-all;
}
footer {
  margin-top: 22px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 8.5pt;
  text-align: center;
}
"""


def _replace_kaynak_tags(html: str, citations: dict[str, dict[str, Any]]) -> str:
    """`[kaynak: uuid]` → `<a class="kaynak">[01]</a>` ya da missing."""
    counter = {"n": 0}
    index_by_uuid: dict[str, int] = {}

    def repl(m: re.Match) -> str:
        uuid_str = m.group(1).lower()
        cit = citations.get(uuid_str)
        if uuid_str not in index_by_uuid:
            counter["n"] += 1
            index_by_uuid[uuid_str] = counter["n"]
        idx = index_by_uuid[uuid_str]
        label = f"[{idx:02d}]"
        if cit and cit.get("url"):
            return (
                f'<a class="kaynak" href="{escape(cit["url"])}" '
                f'title="{escape(cit.get("label", "Kaynak"))}">{label}</a>'
            )
        css = "kaynak" if cit else "kaynak missing"
        return f'<span class="{css}">{label}</span>'

    return _UUID_RE.sub(repl, html), index_by_uuid


def _sources_section_html(
    citations: dict[str, dict[str, Any]],
    index_by_uuid: dict[str, int],
) -> str:
    if not index_by_uuid:
        return ""
    rows: list[str] = []
    sorted_uuids = sorted(index_by_uuid.items(), key=lambda kv: kv[1])
    for uuid_str, idx in sorted_uuids:
        cit = citations.get(uuid_str, {})
        label = cit.get("label") or "Kaynak"
        url = cit.get("url")
        url_html = (
            f'<br/><span class="url">{escape(url)}</span>' if url else ""
        )
        rows.append(
            f"<li><span class=\"lbl\">[{idx:02d}]</span> "
            f"{escape(label)}{url_html}</li>"
        )
    return (
        '<section class="sources">'
        "<h2>Kaynaklar</h2>"
        "<ol>" + "".join(rows) + "</ol>"
        "</section>"
    )


def _confidence_badge_class(confidence: float | None) -> str:
    if confidence is None:
        return "badge"
    if confidence >= 70:
        return "badge confidence"
    if confidence >= 50:
        return "badge persona"
    return "badge warn"


def render_thesis_pdf(
    *,
    ticker: str,
    squad: str | None,
    user_mode: str | None,
    thesis_md: str,
    confidence: float | None,
    thesis_date: str | None,
    had_kaynaksiz_flag: bool,
    citations: dict[str, dict[str, Any]] | None = None,
) -> bytes:
    """Render thesis markdown → PDF bytes.

    `citations` map: `{uuid: {"label": "Mali Tablolar", "url": "https://..."}}`.
    URL'i olmayan kaynaklar yine numaralandırılır ama link verilmez.
    """
    citations = citations or {}
    body_html = md_lib.markdown(
        thesis_md or "",
        extensions=["extra", "sane_lists", "nl2br"],
    )
    body_html, index_by_uuid = _replace_kaynak_tags(body_html, citations)
    sources_html = _sources_section_html(citations, index_by_uuid)

    badges: list[str] = []
    if confidence is not None:
        badges.append(
            f'<span class="{_confidence_badge_class(confidence)}">'
            f"Güven {int(round(confidence))}/100</span>"
        )
    if user_mode:
        mode_label = "Muhafazakâr" if user_mode == "conservative" else "Dengeli"
        badges.append(f'<span class="badge persona">{escape(mode_label)}</span>')
    if squad:
        badges.append(f'<span class="badge">{escape(str(squad))}</span>')
    if had_kaynaksiz_flag:
        badges.append('<span class="badge warn">Kaynaksız iddia uyarısı</span>')

    meta_parts: list[str] = []
    if thesis_date:
        meta_parts.append(f"Tez tarihi: {escape(thesis_date)}")
    meta_parts.append(
        f"Üretildi: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    meta_html = " · ".join(meta_parts)

    full_html = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>{escape(ticker)} Yatırım Tezi</title>
<style>{_CSS}</style>
</head>
<body>
<header>
  <div class="ticker">{escape(ticker)}</div>
  <div class="meta">{meta_html}</div>
  <div class="badges">{''.join(badges)}</div>
</header>
{body_html}
{sources_html}
<div class="disclaimer">
  <strong>Yatırım tavsiyesi değildir.</strong> Bu rapor ThesisForge tarafından
  otomatik üretilmiştir; bilgilendirme amaçlıdır. Yatırım kararları için lisanslı
  bir uzmana danışın. Kaynak linkleri rapor üretildiği andaki referansları
  gösterir.
</div>
<footer>ThesisForge · Çok-ajanlı komite sentezi · {escape(ticker)}</footer>
</body>
</html>
"""
    # Lazy import — weasyprint native deps yoksa modül import zamanında patlamasın.
    from weasyprint import HTML  # type: ignore

    return HTML(string=full_html).write_pdf()
