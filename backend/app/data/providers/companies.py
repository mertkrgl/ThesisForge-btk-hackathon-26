"""BIST şirket listesi + ticker lookup — MKK."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


def _row_to_safe(r: dict | None) -> dict:
    out = {}
    for k, v in (r or {}).items():
        if hasattr(v, "item"):
            v = v.item()
        out[k] = v if isinstance(v, (int, float, str, bool, type(None))) else str(v)
    return out


class MkkCompaniesProvider(DataProvider):
    name = "mkk_companies"

    async def fetch(self, **_) -> ProviderResult:
        from companies import get_bist_companies as _sync  # type: ignore[import-not-found]

        async with acquire("mkk"):
            df = await asyncio.to_thread(_sync)
        if df is None or df.empty:
            raise RuntimeError("no BIST companies")
        records = [_row_to_safe(r) for r in df.fillna("").to_dict("records")]
        return ProviderResult(
            source=self.name,
            payload={"count": len(records), "companies": records},
        )


class CompanyLookupProvider(DataProvider):
    name = "mkk_company_lookup"

    async def fetch(self, *, ticker: str, **_) -> ProviderResult:
        from companies import get_company_by_ticker as _sync  # type: ignore[import-not-found]

        async with acquire("mkk"):
            row = await asyncio.to_thread(_sync, ticker)
        if not row:
            raise RuntimeError(f"company {ticker} not found")
        return ProviderResult(source=self.name, payload=_row_to_safe(row))
