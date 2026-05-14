"""Memory Agent — pgvector cosine similarity + async embedding write."""
from __future__ import annotations

import uuid

from app.agents.embedding import embed_text as _embed
from app.agents.schemas import MemoryHit
from app.agents.sector_map import squad_for_ticker
from app.agents.tools import AgentContext
from app.core.logging import log
from app.db.repo import similarity_search as _repo_search
from app.db.session import session_scope


async def search_memory(
    ctx: AgentContext,
    ticker: str,
    query_text: str | None = None,
    top_k: int = 3,
) -> list[MemoryHit]:
    """Geçmiş tezler arasında semantic search.

    Synthesizer'a `MemoryHit` listesi olarak verilir.
    """
    ctx = ctx.with_agent("memory_agent")
    qtext = query_text or f"{ticker} yatırım tezi"
    try:
        emb = await _embed(qtext)
        rows = await _repo_search(
            ctx.session,
            embedding=emb["vector"],
            ticker=ticker.upper(),
            squad=squad_for_ticker(ticker),
            top_k=top_k,
        )
        hits: list[MemoryHit] = []
        for r in rows:
            outcome = r.get("outcome")
            if outcome not in ("correct", "partial", "wrong"):
                continue
            hits.append(
                MemoryHit(
                    thesis_id=r["id"],
                    ticker=r["ticker"],
                    thesis_date=(
                        r["thesis_date"].isoformat() if r["thesis_date"] else ""
                    ),
                    distance=float(r["distance"]) if r["distance"] is not None else 0.0,
                    outcome=outcome,  # type: ignore[arg-type]
                    ground_truth_return=(
                        float(r["ground_truth_return"])
                        if r["ground_truth_return"] is not None
                        else None
                    ),
                    summary=(r.get("thesis_md") or "")[:500],
                )
            )
        return hits
    except Exception as e:
        log.warning("memory_search_fail", ticker=ticker, error=str(e)[:200])
        return []


async def write_thesis_embedding_async(thesis_id: uuid.UUID, thesis_md: str) -> None:
    """Synthesizer biter bitmez `asyncio.create_task(...)` ile fire-and-forget.

    Yeni bir session açar (orijinal request session'ı kapanmış olabilir).
    """
    try:
        emb = await _embed(thesis_md)
    except Exception as e:
        log.warning("embed_write_fail_in_embed", error=str(e)[:200])
        return

    try:
        from sqlalchemy import update

        from app.db.models import Thesis

        async with session_scope() as s:
            await s.execute(
                update(Thesis).where(Thesis.id == thesis_id).values(embedding=emb["vector"])
            )
            await s.commit()
        log.info(
            "memory_embedding_written",
            thesis_id=str(thesis_id),
            dims=emb["dimensions"],
            stub=emb.get("stub", False),
        )
    except Exception as e:
        log.warning("embed_write_fail_in_db", error=str(e)[:200])
