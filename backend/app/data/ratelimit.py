"""Per-source AsyncLimiter — aiolimiter ile saniyede N istek."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from aiolimiter import AsyncLimiter

from app.core.config import settings


_LIMITERS: dict[str, AsyncLimiter] | None = None


def _build_limiters() -> dict[str, AsyncLimiter]:
    return {
        "yfinance": AsyncLimiter(settings.YFINANCE_RATE_PER_SEC, 1.0),
        "isyatirim": AsyncLimiter(settings.ISYATIRIM_RATE_PER_SEC, 1.0),
        "mkk": AsyncLimiter(settings.MKK_RATE_PER_SEC, 1.0),
        "tcmb": AsyncLimiter(settings.TCMB_RATE_PER_SEC, 1.0),
        "borsapy": AsyncLimiter(settings.BORSAPY_RATE_PER_SEC, 1.0),
        "google_news": AsyncLimiter(1, 1.0),
        "pykap": AsyncLimiter(2, 1.0),
    }


def _get_limiters() -> dict[str, AsyncLimiter]:
    global _LIMITERS
    if _LIMITERS is None:
        _LIMITERS = _build_limiters()
    return _LIMITERS


@asynccontextmanager
async def acquire(source: str) -> AsyncIterator[None]:
    """`async with acquire("yfinance"): ...` formunda kullan."""
    limiter = _get_limiters().get(source)
    if limiter is None:
        yield
        return
    async with limiter:
        yield
