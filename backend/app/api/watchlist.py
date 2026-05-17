"""Watchlist endpoints — GET/POST/DELETE."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repo import add_watchlist, list_watchlist, remove_watchlist
from app.db.session import get_session


router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddRequest(BaseModel):
    user_id: uuid.UUID
    ticker: str


@router.get("")
async def get_watchlist(
    user_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    return await list_watchlist(session, user_id)


@router.post("", status_code=201)
async def post_watchlist(
    req: AddRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    added = await add_watchlist(session, req.user_id, req.ticker)
    await session.commit()
    return {"status": "added" if added else "exists"}


@router.delete("/{ticker}")
async def delete_watchlist(
    ticker: str,
    user_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    removed = await remove_watchlist(session, user_id, ticker)
    await session.commit()
    if not removed:
        raise HTTPException(status_code=404, detail="Ticker watchlist'te yok.")
    return {"status": "removed"}
