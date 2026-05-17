"""Market data endpoints — watchlist enrichment + dashboard charts.

Frontend watchlist kartı ticker başına fiyat + sparkline ister. Backend'de mevcut
yfinance providerlarını çağırarak hafif bir quote endpoint'i sunar; TTLCache ile
5dk içinde tekrar isteklerde external API'ye yük binmez.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.logging import log
from app.data.cache import get_cache_backend


router = APIRouter(prefix="/api/market", tags=["market"])


_QUOTE_TTL_SEC = 300  # 5 dk
_SPARK_POINTS = 24


def _normalize_ticker(t: str) -> str:
    """BIST için '.IS' suffix'i ekle (XU100 gibi index'ler ayrı tutulur)."""
    up = t.strip().upper()
    if up.startswith("^") or "." in up:
        return up
    if up in {"XU100", "BIST100"}:
        return "^XU100"
    return f"{up}.IS"


def _fetch_ohlcv_sync(yf_ticker: str, period: str = "5d", interval: str = "1h") -> list[dict[str, Any]]:
    """yfinance ile son N gün, intraday close serisini çek (blocking)."""
    import yfinance as yf

    tk = yf.Ticker(yf_ticker)
    df = tk.history(period=period, interval=interval, auto_adjust=False)
    if df is None or df.empty:
        # daha geniş aralık dene
        df = tk.history(period="1mo", interval="1d", auto_adjust=False)
    if df is None or df.empty:
        return []
    df = df.tail(_SPARK_POINTS * 2)
    rows: list[dict[str, Any]] = []
    for ts, r in df.iterrows():
        try:
            rows.append(
                {
                    "ts": str(ts),
                    "close": float(r["Close"]) if r.get("Close") is not None else None,
                }
            )
        except Exception:
            continue
    return rows


async def _build_quote(ticker: str) -> dict[str, Any]:
    yf_ticker = _normalize_ticker(ticker)
    rows = await asyncio.to_thread(_fetch_ohlcv_sync, yf_ticker)
    closes: list[float] = [
        r["close"] for r in rows if isinstance(r.get("close"), (int, float))
    ]
    if not closes:
        raise HTTPException(status_code=404, detail=f"Ticker için fiyat bulunamadı: {ticker}")

    spark = closes[-_SPARK_POINTS:] if len(closes) >= 2 else closes
    last = float(spark[-1])
    previous_close = float(spark[0]) if len(spark) > 1 else last
    delta_pct = ((last - previous_close) / previous_close * 100.0) if previous_close else 0.0

    return {
        "ticker": ticker.upper(),
        "last": round(last, 4),
        "previous_close": round(previous_close, 4),
        "delta_pct": round(delta_pct, 4),
        "spark": [round(float(c), 4) for c in spark],
    }


@router.get("/quote/{ticker}")
async def get_quote(ticker: str) -> dict[str, Any]:
    cache = get_cache_backend()
    key = f"market:quote:{ticker.upper()}"
    cached = await cache.get(key)
    if cached is not None:
        return cached

    try:
        quote = await _build_quote(ticker)
    except HTTPException:
        raise
    except Exception as e:
        log.warning("quote_fetch_fail", ticker=ticker, error=str(e)[:200])
        raise HTTPException(status_code=502, detail=f"Quote fetch fail: {e}")

    await cache.set(key, quote, _QUOTE_TTL_SEC)
    return quote
