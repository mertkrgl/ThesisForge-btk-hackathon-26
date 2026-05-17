"""Teknik indikatörler — pandas-ta. OHLCV önce price provider'dan çekilir."""
from __future__ import annotations

import asyncio

import pandas as pd

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult

ensure_product_path()


class PandasTaTechnicalsProvider(DataProvider):
    name = "pandas_ta"

    async def fetch(self, *, ticker: str, days: int = 90, **_) -> ProviderResult:
        # Local hesap için OHLCV gerek → product.prices.get_ohlcv kullan
        from prices import get_ohlcv  # type: ignore[import-not-found]
        from technicals import compute_indicators, technical_signal  # type: ignore[import-not-found]

        df: pd.DataFrame = await asyncio.to_thread(get_ohlcv, ticker, days)
        if df is None or df.empty:
            raise RuntimeError(f"no OHLCV for {ticker} technicals")
        indicators = await asyncio.to_thread(compute_indicators, df)
        signal = await asyncio.to_thread(technical_signal, indicators)
        return ProviderResult(
            source=self.name,
            payload={"indicators": indicators, "signal": signal},
        )
