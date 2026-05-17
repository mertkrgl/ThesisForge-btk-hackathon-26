"""Seed demo theses for base_rate_check tool.

Gün 3B (IMPROVE_PLAN): `base_rate_check` boş DB'de hiçbir şey döndürmüyor →
Devil's Advocate'in `base_rate_warnings` listesi spekülatif kalıyor. Bu script
`backend/fixtures/seed_theses.json` içindeki sahte tezleri DB'ye basar.

Idempotent: aynı (ticker, thesis_date) çifti varsa atlar.

Kullanım:
    python scripts/seed_demo.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Repo root ve backend dizinini path'e ekle (script doğrudan çalıştırılırken).
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.db.models import Thesis  # noqa: E402
from app.db.session import session_scope  # noqa: E402
from app.agents.embedding import embed_text  # noqa: E402


FIXTURES_PATH = BACKEND_DIR / "fixtures" / "seed_theses.json"


def _parse_thesis_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


async def _embedding_for(row: dict) -> list[float]:
    text = (
        f"{row['ticker']} {row['squad']} outcome={row['outcome']} "
        f"return={row.get('ground_truth_return')} confidence={row.get('confidence')}\n"
        f"{row.get('thesis_md') or ''}"
    )
    emb = await embed_text(text)
    return emb["vector"]


async def _seed_one(session, row: dict) -> str:
    ticker = row["ticker"].upper()
    tdate = _parse_thesis_date(row["thesis_date"])
    embedding = await _embedding_for(row)

    # Idempotent guard
    existing = await session.execute(
        select(Thesis).where(
            Thesis.ticker == ticker, Thesis.thesis_date == tdate
        )
    )
    existing_thesis = existing.scalar_one_or_none()
    if existing_thesis is not None:
        changed = False
        if existing_thesis.embedding is None:
            existing_thesis.embedding = embedding
            changed = True
        if existing_thesis.outcome == "pending" and row.get("outcome"):
            existing_thesis.outcome = row["outcome"]
            existing_thesis.ground_truth_return = row.get("ground_truth_return")
            changed = True
        return "update" if changed else "skip"

    t = Thesis(
        ticker=ticker,
        squad=row["squad"],
        user_mode=row.get("user_mode", "default"),
        thesis_date=tdate,
        thesis_md=row.get("thesis_md"),
        confidence=float(row.get("confidence", 50.0)),
        outcome=row["outcome"],
        ground_truth_return=row.get("ground_truth_return"),
        embedding=embedding,
    )
    session.add(t)
    return "insert"


async def main() -> int:
    if not FIXTURES_PATH.exists():
        print(f"[error] seed file not found: {FIXTURES_PATH}", file=sys.stderr)
        return 2

    with FIXTURES_PATH.open(encoding="utf-8") as f:
        data = json.load(f)

    theses = data.get("theses") or []
    if not theses:
        print("[warn] no theses in seed file")
        return 0

    inserted = 0
    updated = 0
    skipped = 0
    by_squad: dict[str, dict[str, int]] = {}

    async with session_scope() as session:
        for row in theses:
            status = await _seed_one(session, row)
            if status == "insert":
                inserted += 1
                sq = row["squad"]
                oc = row["outcome"]
                by_squad.setdefault(sq, {"correct": 0, "partial": 0, "wrong": 0})
                by_squad[sq][oc] = by_squad[sq].get(oc, 0) + 1
            elif status == "update":
                updated += 1
            else:
                skipped += 1
        await session.commit()

    print(f"inserted = {inserted}, updated = {updated}, skipped = {skipped}")
    for sq, counts in sorted(by_squad.items()):
        total = sum(counts.values())
        succ = counts.get("correct", 0)
        rate = round(succ / total * 100, 1) if total else 0.0
        print(f"  {sq:<12} total={total:>2}  correct={succ:>2}  rate={rate}%")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
