"""Market data endpoints — watchlist enrichment + dashboard charts.

Frontend watchlist kartı ticker başına fiyat + sparkline ister. Backend'de mevcut
yfinance providerlarını çağırarak hafif bir quote endpoint'i sunar; TTLCache ile
1dk içinde tekrar isteklerde external API'ye yük binmez.

Anlık fiyat için yfinance fast_info kullanılır (Google Finance ile tutarlı).
Sparkline chart verisi historical OHLCV'den gelir.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.logging import log
from app.data.cache import get_cache_backend


router = APIRouter(prefix="/api/market", tags=["market"])


_QUOTE_TTL_SEC = 60  # 1 dk — piyasa açıkken daha güncel veri
_SPARK_POINTS = 24


def _normalize_ticker(t: str) -> str:
    """BIST için '.IS' suffix'i ekle (XU100 gibi index'ler ayrı tutulur)."""
    up = t.strip().upper()
    if up.startswith("^") or "." in up:
        return up
    if up in {"XU100", "BIST100"}:
        return "XU100.IS"
    return f"{up}.IS"


def _fetch_realtime_quote_sync(yf_ticker: str) -> dict[str, Any]:
    """yfinance fast_info ile anlık fiyat, önceki kapanış ve sparkline çek (blocking).

    fast_info → last_price, previous_close (Google Finance ile tutarlı gerçek zamanlı)
    history → sparkline chart verisi
    """
    import yfinance as yf

    tk = yf.Ticker(yf_ticker)

    # --- Anlık fiyat bilgisi ---
    last_price: float | None = None
    prev_close: float | None = None

    try:
        fi = tk.fast_info
        last_price = float(fi.last_price) if fi.last_price is not None else None
        prev_close = float(fi.previous_close) if fi.previous_close is not None else None
    except Exception:
        pass

    # fast_info başarısız olursa info dict'ten dene
    if last_price is None:
        try:
            info = tk.info
            last_price = info.get("regularMarketPrice") or info.get("currentPrice")
            prev_close = prev_close or info.get("regularMarketPreviousClose") or info.get("previousClose")
            if last_price is not None:
                last_price = float(last_price)
            if prev_close is not None:
                prev_close = float(prev_close)
        except Exception:
            pass

    # --- Sparkline verileri (grafik için) ---
    spark_closes: list[float] = []
    try:
        df = tk.history(period="5d", interval="1h", auto_adjust=False)
        if df is None or df.empty:
            df = tk.history(period="1mo", interval="1d", auto_adjust=False)
        if df is not None and not df.empty:
            df = df.tail(_SPARK_POINTS * 2)
            for _ts, r in df.iterrows():
                try:
                    c = r.get("Close")
                    if c is not None:
                        spark_closes.append(float(c))
                except Exception:
                    continue
    except Exception:
        pass

    # Eğer fast_info'dan fiyat gelemediyse sparkline'dan son değeri al (fallback)
    if last_price is None and spark_closes:
        last_price = spark_closes[-1]
    if prev_close is None and len(spark_closes) >= 2:
        prev_close = spark_closes[0]

    return {
        "last_price": last_price,
        "previous_close": prev_close,
        "spark_closes": spark_closes,
    }


async def _build_quote(ticker: str) -> dict[str, Any]:
    yf_ticker = _normalize_ticker(ticker)
    data = await asyncio.to_thread(_fetch_realtime_quote_sync, yf_ticker)

    last_price = data["last_price"]
    prev_close = data["previous_close"]
    spark_closes: list[float] = data["spark_closes"]

    if last_price is None:
        raise HTTPException(status_code=404, detail=f"Ticker için fiyat bulunamadı: {ticker}")

    # Sparkline: chart verisi + son anlık fiyatı sona ekle
    spark = spark_closes[-_SPARK_POINTS:] if len(spark_closes) >= 2 else spark_closes
    # Sparkline'ın son değeri anlık fiyatla tutarlı olsun
    if spark:
        spark = list(spark)  # kopyala
        spark[-1] = last_price
    else:
        spark = [last_price]

    # Günlük değişim yüzdesi
    if prev_close and prev_close > 0:
        delta_pct = ((last_price - prev_close) / prev_close) * 100.0
    else:
        delta_pct = 0.0

    return {
        "ticker": ticker.upper(),
        "last": round(last_price, 4),
        "previous_close": round(prev_close, 4) if prev_close else round(last_price, 4),
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
