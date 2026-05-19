"""POST /chat — mesajdan ticker çıkar, skeleton oluştur, orchestrator'ı arkaplanda çalıştır."""
from __future__ import annotations

import asyncio
import re
import uuid
from functools import partial
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.agents.orchestrator import run_thesis
from app.agents.sector_map import load_sector_map
from app.api.deps import get_current_user
from app.api.ws_hub import hub
from app.core.logging import log
from app.db.models import User
from app.db.repo import create_thesis_skeleton
from app.db.session import session_scope


router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    mode: Literal["default", "conservative"] = "default"
    ticker: str | None = Field(
        default=None,
        description="Mesajda ticker tahmin edilemezse buradan zorla.",
    )


class ChatResponse(BaseModel):
    thesis_id: uuid.UUID
    ticker: str
    ws_url: str


_TICKER_RE = re.compile(r"\b([A-ZĞÜŞİÖÇ]{3,6})\b")


def _all_known_tickers() -> set[str]:
    out: set[str] = set()
    for cfg in load_sector_map().values():
        tickers = (cfg.get("tickers") or []) if isinstance(cfg, dict) else []
        for t in tickers:
            out.add(t.upper())
    return out


def _parse_ticker(message: str, override: str | None) -> str | None:
    """Ticker bul: önce orijinal mesajda büyük harfli token, sonra known liste.

    Türkçe kelimelerin ('MERHABA', 'DÜNYA') yanlış ticker'a düşmesini önlemek
    için fallback sadece **orijinal mesajda zaten büyük harfli** olan veya
    sector_map'te kayıtlı tickerlar için çalışır.
    """
    if override:
        return override.strip().upper()

    known = _all_known_tickers()

    # 1. Orijinal mesajda büyük harfli token — kullanıcı bilinçli yazdı
    for c in _TICKER_RE.findall(message):
        if c.isalpha() and 3 <= len(c) <= 6:
            if c in known:
                return c
            # bilinmeyen ama uppercase — ticker varsay (Generic squad)
            return c

    # 2. Case-insensitive: sector_map'te kayıtlı olanları her durumda yakala
    msg_up = message.upper()
    for c in _TICKER_RE.findall(msg_up):
        if c in known:
            return c

    return None


async def _spawn_pipeline(
    thesis_id: uuid.UUID,
    ticker: str,
    user_id: uuid.UUID | None,
    mode: str,
) -> None:
    publish = partial(hub.publish, thesis_id)
    try:
        await run_thesis(
            ticker,
            user_id=user_id,
            user_mode=mode,
            thesis_id=thesis_id,
            websocket_emit=publish,
            timeout_sec=200.0,
        )
    except Exception as e:
        log.error("pipeline_fail", thesis_id=str(thesis_id), error=str(e)[:300])
        await hub.publish(thesis_id, {"type": "error", "msg": str(e)[:200]})


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current: User = Depends(get_current_user),
) -> ChatResponse:
    ticker = _parse_ticker(req.message, req.ticker)
    if not ticker:
        raise HTTPException(
            status_code=400,
            detail="Mesajdan ticker çıkarılamadı. 'ticker' alanını gönder.",
        )

    async with session_scope() as s:
        thesis_id = await create_thesis_skeleton(
            s,
            ticker=ticker,
            user_id=current.id,
            user_mode=req.mode,
            squad="Generic",
        )
        await s.commit()

    asyncio.create_task(
        _spawn_pipeline(thesis_id, ticker, current.id, req.mode)
    )

    return ChatResponse(
        thesis_id=thesis_id,
        ticker=ticker,
        ws_url=f"/ws/thesis/{thesis_id}",
    )
