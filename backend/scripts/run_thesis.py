"""Tek komutla tez üret + sonucu markdown dosyasına yaz.

Kullanım:
    python scripts/run_thesis.py [TICKER] [MODE]

Normalde repo kökündeki `run.sh` çağırır. Uvicorn 127.0.0.1:8000'de çalışıyor
olmalı (run.sh otomatik ayağa kaldırır).

Çıktı: `<repo>/thesis_output_<TICKER>_<MODE>.md`
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx
import websockets


BASE = "http://127.0.0.1:8000"
WS_BASE = "ws://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parents[2]


async def run(ticker: str, mode: str) -> int:
    ticker = ticker.upper()

    print(f"  > POST /chat (ticker={ticker}, mode={mode})")
    async with httpx.AsyncClient(timeout=30) as ac:
        r = await ac.post(
            f"{BASE}/chat", json={"message": f"{ticker} analiz et", "mode": mode}
        )
        if r.status_code != 200:
            print(f"  [error] POST /chat → {r.status_code}: {r.text[:200]}")
            return 2
        body = r.json()
        thesis_id = body["thesis_id"]
        ws_url = body["ws_url"]
        print(f"    thesis_id = {thesis_id}")

    print(f"  > WS event stream (max 320s)...")
    t0 = time.time()
    done = False
    error_msg: str | None = None
    critique: dict | None = None
    try:
        async with websockets.connect(f"{WS_BASE}{ws_url}") as ws:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=320.0)
                ev = json.loads(raw)
                t = time.time() - t0
                etype = ev.get("type")
                if etype == "stage":
                    print(f"    [{t:6.1f}s] stage = {ev.get('stage','')}")
                elif etype == "critique":
                    critique = ev.get("critique") or {}
                    strength = critique.get("overall_critique_strength", "?")
                    n_risks = len(critique.get("cross_cutting_risks") or [])
                    n_base = len(critique.get("base_rate_warnings") or [])
                    print(
                        f"    [{t:6.1f}s] critique  strength={strength}  "
                        f"risks={n_risks}  base_rate={n_base}"
                    )
                elif etype == "done":
                    print(
                        f"    [{t:6.1f}s] DONE confidence={ev.get('confidence')} "
                        f"kaynaksız={ev.get('had_kaynaksiz_flag')}"
                    )
                    done = True
                    break
                elif etype == "error":
                    error_msg = ev.get("msg", "?")
                    print(f"    [{t:6.1f}s] ERROR: {error_msg}")
                    break
    except asyncio.TimeoutError:
        error_msg = "WS timeout 240s — pipeline takıldı"
        print(f"    [error] {error_msg}")

    print(f"  > GET /api/thesis/{thesis_id}")
    async with httpx.AsyncClient(timeout=15) as ac:
        r = await ac.get(f"{BASE}/api/thesis/{thesis_id}")
        if r.status_code != 200:
            print(f"  [error] GET → {r.status_code}: {r.text[:200]}")
            return 3
        d = r.json()

        # Citations ayrı endpoint'te tutuluyor
        rc = await ac.get(f"{BASE}/api/thesis/{thesis_id}/citations")
        citations = rc.json() if rc.status_code == 200 else []

    out_path = REPO_ROOT / f"thesis_output_{ticker}_{mode}.md"
    out_path.write_text(
        _render_markdown(d, critique=critique, citations=citations, error_msg=error_msg),
        encoding="utf-8",
    )

    md_len = len(d.get("thesis_md") or "")
    print()
    print(f"  [ok] Çıktı yazıldı: {out_path}")
    print(
        f"       thesis_md={md_len} char  |  bull={len(d.get('bull_points') or [])}  "
        f"|  bear={len(d.get('bear_points') or [])}  "
        f"|  catalyst={len(d.get('catalysts') or [])}"
    )
    print(
        f"       confidence={d.get('confidence')}/100  |  "
        f"kaynaksız_flag={d.get('had_kaynaksiz_flag')}  |  "
        f"squad={d.get('squad')}"
    )

    if not done:
        return 4
    return 0


def _render_markdown(
    d: dict,
    *,
    critique: dict | None = None,
    citations: list[dict] | None = None,
    error_msg: str | None = None,
) -> str:
    lines: list[str] = []
    ticker = d.get("ticker", "?")
    lines.append(f"# {ticker} Tez Çıktısı\n")
    lines.append(f"**Thesis ID**: `{d.get('thesis_id', '?')}`  ")
    lines.append(f"**Squad**: {d.get('squad')}  ")
    lines.append(f"**User mode**: {d.get('user_mode')}  ")
    lines.append(f"**Final confidence**: {d.get('confidence')}/100  ")
    lines.append(f"**Kaynaksız flag**: {d.get('had_kaynaksiz_flag')}  ")
    md_text = d.get("thesis_md") or ""
    lines.append(f"**thesis_md uzunluk**: {len(md_text)} karakter\n")
    if error_msg:
        lines.append(f"> **UYARI**: pipeline tamamlanmadan kesildi — {error_msg}\n")

    lines.append("---\n")
    lines.append("## 1. Markdown Tez\n")
    if md_text.strip():
        lines.append("```markdown")
        lines.append(md_text.rstrip())
        lines.append("```\n")
    else:
        lines.append("_(markdown üretilmedi — pipeline başarısız)_\n")

    lines.append("---\n")
    lines.append("## 2. Confidence Breakdown\n")
    bd = d.get("confidence_breakdown") or {}
    lines.append("| Bileşen | Değer |")
    lines.append("|---|---|")
    for k in (
        "data_quality", "technical", "fundamental", "news_macro",
        "memory_base", "devil_inverse", "computed_raw", "applied_cap", "final",
    ):
        lines.append(f"| `{k}` | {bd.get(k)} |")
    lines.append("")

    lines.append("---\n")
    bull = d.get("bull_points") or []
    lines.append(f"## 3. Bull Points ({len(bull)})\n")
    for i, b in enumerate(bull, 1):
        lines.append(
            f"### Bull #{i}  —  score `{b.get('score','?')}`  —  call_id `{b.get('call_id')}`"
        )
        lines.append(f"\n{b.get('point','')}\n")

    lines.append("---\n")
    bear = d.get("bear_points") or []
    lines.append(f"## 4. Bear Points ({len(bear)})\n")
    for i, b in enumerate(bear, 1):
        lines.append(
            f"### Bear #{i}  —  score `{b.get('score','?')}`  —  call_id `{b.get('call_id')}`"
        )
        lines.append(f"\n{b.get('point','')}\n")

    lines.append("---\n")
    cats = d.get("catalysts") or []
    lines.append(f"## 5. Catalysts ({len(cats)})\n")
    for i, c in enumerate(cats, 1):
        lines.append(
            f"### Catalyst #{i}  —  date `{c.get('date')}`  —  impact `{c.get('impact')}`  —  call_id `{c.get('call_id')}`"
        )
        lines.append(f"\n{c.get('event','')}\n")

    lines.append("---\n")
    if critique:
        lines.append("## 6. Devil's Advocate — Ham Counter-Argümanlar\n")
        strength = critique.get("overall_critique_strength")
        lines.append(
            f"**overall_critique_strength**: `{strength}/100`  "
            f"(yüksek = güçlü karşıt argüman; `confidence_breakdown.devil_inverse = 100 - strength`)\n"
        )

        def _bullets(title: str, items: list, empty_msg: str) -> list[str]:
            out = [f"### {title}\n"]
            if items:
                for it in items:
                    out.append(f"- {it}")
            else:
                out.append(f"_({empty_msg})_")
            out.append("")
            return out

        lines.extend(
            _bullets(
                "Technical Pushback",
                critique.get("technical_pushback") or [],
                "technical pushback üretilmedi",
            )
        )
        lines.extend(
            _bullets(
                "Fundamental Pushback",
                critique.get("fundamental_pushback") or [],
                "fundamental pushback üretilmedi",
            )
        )
        lines.extend(
            _bullets(
                "Cross-Cutting Risks",
                critique.get("cross_cutting_risks") or [],
                "cross-cutting risk üretilmedi",
            )
        )
        lines.extend(
            _bullets(
                "Base Rate Warnings",
                critique.get("base_rate_warnings") or [],
                "base rate uyarısı üretilmedi",
            )
        )
        lines.append("---\n")
    else:
        lines.append("## 6. Devil's Advocate — Ham Counter-Argümanlar\n")
        lines.append("_(critique event yakalanamadı — pipeline kesintiye uğramış olabilir)_\n")
        lines.append("---\n")

    lines.append("## 7. Citation Audit\n")
    cits = citations if citations is not None else (d.get("citations") or [])
    ok = sum(1 for c in cits if not c.get("is_kaynaksiz"))
    ks = len(cits) - ok
    lines.append(
        f"**Toplam claim**: {len(cits)}  |  **Kaynaklı**: {ok}  |  **Kaynaksız**: {ks}\n"
    )
    if cits:
        lines.append("| # | Kaynaksız? | call_id | Claim |")
        lines.append("|---|---|---|---|")
        for i, c in enumerate(cits, 1):
            cid = (c.get("call_id") or "—")[:18]
            txt = (c.get("claim_text") or "").replace("|", "\\|").replace("\n", " ")[:140]
            mark = "kaynaksız" if c.get("is_kaynaksiz") else "kaynaklı"
            lines.append(f"| {i} | {mark} | `{cid}` | {txt} |")

    return "\n".join(lines)


if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "ASELS"
    m = sys.argv[2] if len(sys.argv) > 2 else "default"
    if m not in ("default", "conservative"):
        print(f"ERROR: mode 'default' veya 'conservative' olmalı (gelen: '{m}')")
        sys.exit(1)
    sys.exit(asyncio.run(run(t, m)))
