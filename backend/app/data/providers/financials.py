"""Finansal tablo + ratio sağlayıcıları — isyatirimhisse."""
from __future__ import annotations

import asyncio

import pandas as pd

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


def _financials_to_payload(df: pd.DataFrame) -> dict:
    if df is None or df.empty:
        return {"rows": 0, "quarters": [], "rows_data": []}
    quarter_cols = [c for c in df.columns if isinstance(c, str) and "/" in c]
    return {
        "rows": len(df),
        "quarters": quarter_cols,
        "financial_group": df.attrs.get("financial_group"),
        "rows_data": df.fillna("").astype(str).to_dict("records"),
    }


class IsyatirimFinancialsProvider(DataProvider):
    name = "isyatirim_financials"

    async def fetch(self, *, ticker: str, years: int = 2, **_) -> ProviderResult:
        from financials import (  # type: ignore[import-not-found]
            get_financials as _sync_fin,
            get_latest_quarter as _sync_q,
        )

        async with acquire("isyatirim"):
            df = await asyncio.to_thread(_sync_fin, ticker, years)
            latest = await asyncio.to_thread(_sync_q, ticker)

        if df is None or df.empty:
            raise RuntimeError(f"financials empty for {ticker}")

        payload = _financials_to_payload(df)
        # latest_quarter sayısal değerleri JSON-serializable yap
        latest_clean = {}
        for k, v in (latest or {}).items():
            if hasattr(v, "item"):
                v = v.item()
            try:
                latest_clean[k] = float(v) if isinstance(v, (int, float)) else str(v)
            except Exception:
                latest_clean[k] = str(v)
        payload["latest_quarter"] = latest_clean
        return ProviderResult(source=self.name, payload=payload)


class RatiosProvider(DataProvider):
    name = "isyatirim_ratios"

    async def fetch(self, *, ticker: str, **_) -> ProviderResult:
        from financials import compute_basic_ratios as _sync  # type: ignore[import-not-found]

        async with acquire("isyatirim"):
            ratios = await asyncio.to_thread(_sync, ticker)
        if not ratios:
            raise RuntimeError(f"ratios empty for {ticker}")
        # ensure JSON-serializable
        clean = {}
        for k, v in ratios.items():
            if hasattr(v, "item"):
                v = v.item()
            try:
                clean[k] = float(v) if isinstance(v, (int, float)) else str(v)
            except Exception:
                clean[k] = str(v)
        return ProviderResult(source=self.name, payload=clean)
