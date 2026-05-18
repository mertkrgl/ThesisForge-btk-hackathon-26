"""Watchlist endpoints — GET/POST/DELETE.

P1 auth sonrası: tüm endpoint'ler get_current_user dependency'si kullanır.
user_id artık query/body'den DEĞİL JWT'den çekilir; demo user_id flow'u
deprecated.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.repo import (
    add_watchlist,
    list_watchlist,
    remove_watchlist,
)
from app.db.session import get_session


router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddRequest(BaseModel):
    ticker: str


@router.get("")
async def get_watchlist(
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    return await list_watchlist(session, current.id)


@router.post("", status_code=201)
async def post_watchlist(
    req: AddRequest,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    # Ticker doğrulaması: MKK şirket listesinde yoksa 404. CompanyLookupProvider
    # sync csv lookup'ı thread'e atıyor, ~ms düzeyinde. Önceden bilinmeyen
    # sembol watchlist'e eklenip frontend'de hisse adı boş görünüyordu.
    from app.data.providers.companies import CompanyLookupProvider

    try:
        await CompanyLookupProvider().fetch(ticker=req.ticker)
    except RuntimeError:
        raise HTTPException(
            status_code=404,
            detail=f"{req.ticker.upper()} sembolü BIST'te bulunmuyor.",
        )
    added = await add_watchlist(session, current.id, req.ticker)
    await session.commit()
    return {"status": "added" if added else "exists"}


@router.delete("/{ticker}")
async def delete_watchlist(
    ticker: str,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    removed = await remove_watchlist(session, current.id, ticker)
    await session.commit()
    if not removed:
        raise HTTPException(status_code=404, detail="Ticker watchlist'te yok.")
    return {"status": "removed"}
