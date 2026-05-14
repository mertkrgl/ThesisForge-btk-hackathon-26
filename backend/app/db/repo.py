"""Async CRUD wrapper'ları — pipeline DB yüzeyi.

Memory similarity_search + nightly outcome cron query'leri burada.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, or_, select, text as sql_text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Citation, Thesis, ToolCallLog, User


# ───────────────────────── Users ─────────────────────────


async def ensure_user(session: AsyncSession, *, email: str) -> User:
    """Email yoksa oluştur, var olanı döndür."""
    res = await session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user is not None:
        return user
    user = User(email=email)
    session.add(user)
    await session.flush()
    return user


# ───────────────────────── Theses ─────────────────────────


async def create_thesis_skeleton(
    session: AsyncSession,
    *,
    ticker: str,
    user_id: uuid.UUID | None = None,
    user_mode: str = "default",
    squad: str = "Generic",
    price_at_thesis: float | None = None,
) -> uuid.UUID:
    """Pipeline başında tek satır INSERT; outcome='pending' default."""
    t = Thesis(
        ticker=ticker.upper(),
        user_id=user_id,
        user_mode=user_mode,
        squad=squad,
        price_at_thesis=price_at_thesis,
    )
    session.add(t)
    await session.flush()
    return t.id


async def get_thesis(
    session: AsyncSession, thesis_id: uuid.UUID
) -> Thesis | None:
    res = await session.execute(select(Thesis).where(Thesis.id == thesis_id))
    return res.scalar_one_or_none()


async def update_thesis_kaynaksiz_flag(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    value: bool,
) -> None:
    await session.execute(
        update(Thesis)
        .where(Thesis.id == thesis_id)
        .values(had_kaynaksiz_flag=value)
    )


# ───────────────────────── Tool Call Logs ─────────────────────────


async def insert_tool_call_log(
    session: AsyncSession,
    *,
    thesis_id: uuid.UUID | None,
    agent_id: str,
    tool_name: str,
    args: dict[str, Any] | None,
    result: dict[str, Any] | None,
    latency_ms: int | None,
) -> uuid.UUID:
    """Her tool çağrısı için satır INSERT, call_id RETURNING."""
    row = ToolCallLog(
        thesis_id=thesis_id,
        agent_id=agent_id,
        tool_name=tool_name,
        args=args,
        result=result,
        latency_ms=latency_ms,
    )
    session.add(row)
    await session.flush()
    return row.call_id


async def get_tool_call_log(
    session: AsyncSession,
    call_id: uuid.UUID | str,
    thesis_id: uuid.UUID | None = None,
) -> ToolCallLog | None:
    """Citation validator için PK lookup. thesis_id verilirse o teze ait olmasını şart koşar."""
    if isinstance(call_id, str):
        try:
            call_id = uuid.UUID(call_id)
        except (ValueError, TypeError):
            return None

    q = select(ToolCallLog).where(ToolCallLog.call_id == call_id)
    if thesis_id is not None:
        q = q.where(ToolCallLog.thesis_id == thesis_id)
    res = await session.execute(q)
    return res.scalar_one_or_none()


# ───────────────────────── Citations ─────────────────────────


# ───────────────────────── Memory: similarity + persist ─────────────────────────


def _vec_to_pg(v: list[float]) -> str:
    """Python listesini pgvector string formatına çevir: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


async def similarity_search(
    session: AsyncSession,
    *,
    embedding: list[float],
    ticker: str | None = None,
    squad: str | None = None,
    top_k: int = 3,
    horizon_days: int = 730,
) -> list[dict[str, Any]]:
    """pgvector cosine search — aynı ticker VEYA aynı squad.

    Tez henüz embedding'i yazılmamışsa skip; outcome != 'pending'.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=horizon_days)
    filters = ["embedding IS NOT NULL", "outcome != 'pending'", "thesis_date >= :cutoff"]
    params: dict[str, Any] = {"cutoff": cutoff, "top_k": top_k, "emb": _vec_to_pg(embedding)}
    or_clause = []
    if ticker:
        or_clause.append("ticker = :ticker")
        params["ticker"] = ticker.upper()
    if squad:
        or_clause.append("squad = :squad")
        params["squad"] = squad
    if or_clause:
        filters.append("(" + " OR ".join(or_clause) + ")")

    sql = sql_text(
        f"""
        SELECT id, ticker, squad, thesis_date, thesis_md, outcome, ground_truth_return,
               (embedding <=> CAST(:emb AS vector)) AS distance
        FROM theses
        WHERE {' AND '.join(filters)}
        ORDER BY distance ASC
        LIMIT :top_k
        """
    )
    res = await session.execute(sql, params)
    rows = res.mappings().all()
    return [dict(r) for r in rows]


async def get_pending_theses(
    session: AsyncSession,
    *,
    older_than_days: int = 7,
    limit: int = 500,
) -> list[Thesis]:
    """Nightly cron için: thesis_date eski + outcome pending."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    res = await session.execute(
        select(Thesis)
        .where(Thesis.outcome == "pending")
        .where(Thesis.thesis_date < cutoff)
        .order_by(Thesis.thesis_date)
        .limit(limit)
    )
    return list(res.scalars().all())


async def update_thesis_outcome(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    *,
    price_7d: float | None,
    price_30d: float | None,
    price_90d: float | None,
    ground_truth_return: float | None,
    outcome: str,
) -> None:
    await session.execute(
        update(Thesis)
        .where(Thesis.id == thesis_id)
        .values(
            price_7d=price_7d,
            price_30d=price_30d,
            price_90d=price_90d,
            ground_truth_return=ground_truth_return,
            outcome=outcome,
        )
    )


async def update_thesis_synthesis(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    *,
    thesis_md: str,
    bull_points: list[dict] | None,
    bear_points: list[dict] | None,
    catalysts: list[dict] | None,
    confidence: float | None,
    confidence_breakdown: dict | None,
    squad: str | None = None,
) -> None:
    values: dict[str, Any] = {
        "thesis_md": thesis_md,
        "bull_points": bull_points,
        "bear_points": bear_points,
        "catalysts": catalysts,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
    }
    if squad:
        values["squad"] = squad
    await session.execute(update(Thesis).where(Thesis.id == thesis_id).values(**values))


async def insert_citation(
    session: AsyncSession,
    *,
    thesis_id: uuid.UUID,
    claim_text: str,
    call_id: uuid.UUID | str | None,
    is_kaynaksiz: bool,
) -> uuid.UUID:
    """Citation satırı. CHECK constraint: is_kaynaksiz↔call_id tutarlı olmalı."""
    if isinstance(call_id, str):
        try:
            call_id = uuid.UUID(call_id)
        except (ValueError, TypeError):
            call_id = None
            is_kaynaksiz = True

    row = Citation(
        thesis_id=thesis_id,
        claim_text=claim_text,
        call_id=call_id,
        is_kaynaksiz=is_kaynaksiz,
    )
    session.add(row)
    await session.flush()
    return row.id
