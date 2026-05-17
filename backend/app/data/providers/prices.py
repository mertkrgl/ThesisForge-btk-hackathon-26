"""Hisse fiyat sağlayıcıları — yfinance primary, isyatirim fallback."""
from __future__ import annotations

import asyncio
from typing import Any

import pandas as pd

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


def _df_to_payload(df: pd.DataFrame) -> dict[str, Any]:
    """OHLCV DataFrame → JSON-serializable dict."""
    if df is None or df.empty:
        return {"rows": 0, "ohlcv": []}
    out = df.copy()
    out.index = out.index.astype(str)
    records = out.reset_index().rename(columns={"index": "Date"}).to_dict("records")
    # numpy dtypes → python primitives
    cleaned = []
    for r in records:
        cleaned.append({k: (float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else str(v) if hasattr(v, "isoformat") else v) for k, v in r.items()})
    last_close = float(df["Close"].iloc[-1]) if "Close" in df.columns and len(df) else None
    first_close = float(df["Close"].iloc[0]) if "Close" in df.columns and len(df) else None
    return {
        "rows": len(df),
        "last_close": last_close,
        "first_close": first_close,
        "ohlcv": cleaned,
    }


class YFinancePriceProvider(DataProvider):
    name = "yfinance"

    async def fetch(self, *, ticker: str, days: int = 90, **_) -> ProviderResult:
        from prices import get_ohlcv as _sync  # type: ignore[import-not-found]

        async with acquire("yfinance"):
            df: pd.DataFrame = await asyncio.to_thread(_sync, ticker, days)
        if df is None or df.empty:
            raise RuntimeError(f"yfinance returned empty for {ticker}")
        if df.attrs.get("source") and df.attrs["source"] != "yfinance":
            # script içeride zaten isyatirim'a düşmüş; yine de yfinance görmedik
            raise RuntimeError(
                f"yfinance fallback'a düştü ({df.attrs.get('source')}) — chain bir sonrakini denemeli"
            )
        return ProviderResult(source=self.name, payload=_df_to_payload(df))


class IsyatirimPriceProvider(DataProvider):
    name = "isyatirim"

    async def fetch(self, *, ticker: str, days: int = 90, **_) -> ProviderResult:
        from prices import get_ohlcv as _sync  # type: ignore[import-not-found]

        # scripts/product/prices.get_ohlcv yfinance + isyatirim fallback'i içeride yapıyor;
        # bu provider o fonksiyonu zorunlu olarak çağırır ve "isyatirim" attr'ı ile filtreler.
        async with acquire("isyatirim"):
            df: pd.DataFrame = await asyncio.to_thread(_sync, ticker, days)
        if df is None or df.empty:
            raise RuntimeError(f"isyatirim returned empty for {ticker}")
        return ProviderResult(
            source=df.attrs.get("source", self.name),
            payload=_df_to_payload(df),
        )


class IndexProvider(DataProvider):
    name = "yfinance_index"

    async def fetch(self, *, index_code: str = "XU100", days: int = 90, **_) -> ProviderResult:
        from prices import get_index as _sync  # type: ignore[import-not-found]

        async with acquire("yfinance"):
            df: pd.DataFrame = await asyncio.to_thread(_sync, index_code, days)
        if df is None or df.empty:
            raise RuntimeError(f"index {index_code} empty")
        return ProviderResult(
            source=df.attrs.get("source", self.name),
            payload=_df_to_payload(df),
        )


class DividendProvider(DataProvider):
    name = "yfinance_dividend"

    async def fetch(self, *, ticker: str, **_) -> ProviderResult:
        from prices import get_dividends as _sync  # type: ignore[import-not-found]

        async with acquire("yfinance"):
            series: pd.Series = await asyncio.to_thread(_sync, ticker)
        records = []
        if series is not None and len(series) > 0:
            for dt, val in series.items():
                records.append(
                    {"date": str(dt)[:10], "dividend": float(val)}
                )
        return ProviderResult(
            source=self.name,
            payload={"count": len(records), "dividends": records},
        )


class BrentOilProvider(DataProvider):
    name = "yfinance_brent"

    async def fetch(self, *, days: int = 30, **_) -> ProviderResult:
        from prices import get_brent_oil as _sync  # type: ignore[import-not-found]

        async with acquire("yfinance"):
            df: pd.DataFrame = await asyncio.to_thread(_sync, days)
        if df is None or df.empty:
            raise RuntimeError("brent empty")
        return ProviderResult(source=self.name, payload=_df_to_payload(df))
