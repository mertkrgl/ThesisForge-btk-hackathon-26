"""GET /api/thesis/{id} ve /api/thesis/{id}/citations."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repo import get_thesis, list_citations_with_tool_results, list_theses
from app.db.session import get_session


router = APIRouter(prefix="/api", tags=["thesis"])


def _thesis_to_dict(t) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "ticker": t.ticker,
        "squad": t.squad,
        "user_mode": t.user_mode,
        "user_id": str(t.user_id) if t.user_id else None,
        "thesis_date": t.thesis_date.isoformat() if t.thesis_date else None,
        "thesis_md": t.thesis_md,
        "bull_points": t.bull_points,
        "bear_points": t.bear_points,
        "catalysts": t.catalysts,
        "confidence": float(t.confidence) if t.confidence is not None else None,
        "confidence_breakdown": t.confidence_breakdown,
        "memory_hits": t.memory_hits or [],
        "price_at_thesis": float(t.price_at_thesis) if t.price_at_thesis is not None else None,
        "price_7d": float(t.price_7d) if t.price_7d is not None else None,
        "price_30d": float(t.price_30d) if t.price_30d is not None else None,
        "price_90d": float(t.price_90d) if t.price_90d is not None else None,
        "ground_truth_return": t.ground_truth_return,
        "outcome": t.outcome,
        "had_kaynaksiz_flag": t.had_kaynaksiz_flag,
    }


def _thesis_summary(t) -> dict[str, Any]:
    """Liste için thesis_md hariç hafif DTO; kart UI'ında gerekli tüm alanlar var."""
    bull = t.bull_points or []
    bear = t.bear_points or []
    bull_count = len(bull) if isinstance(bull, list) else 0
    bear_count = len(bear) if isinstance(bear, list) else 0
    return {
        "id": str(t.id),
        "ticker": t.ticker,
        "squad": t.squad,
        "user_mode": t.user_mode,
        "user_id": str(t.user_id) if t.user_id else None,
        "thesis_date": t.thesis_date.isoformat() if t.thesis_date else None,
        "bull_points": bull,
        "bear_points": bear,
        "catalysts": t.catalysts or [],
        "bull_count": bull_count,
        "bear_count": bear_count,
        "confidence": float(t.confidence) if t.confidence is not None else None,
        "outcome": t.outcome,
        "had_kaynaksiz_flag": t.had_kaynaksiz_flag,
    }


@router.get("/theses")
async def read_theses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID | None = Query(default=None),
    ticker: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    rows = await list_theses(
        session,
        limit=limit,
        offset=offset,
        user_id=user_id,
        ticker=ticker,
    )
    return [_thesis_summary(t) for t in rows]


@router.get("/thesis/{thesis_id}")
async def read_thesis(
    thesis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    t = await get_thesis(session, thesis_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    return _thesis_to_dict(t)


@router.get("/thesis/{thesis_id}/citations")
async def read_citations(
    thesis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    t = await get_thesis(session, thesis_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    return await list_citations_with_tool_results(session, thesis_id)
