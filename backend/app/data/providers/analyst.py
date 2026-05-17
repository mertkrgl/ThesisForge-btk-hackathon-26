"""Analist tavsiyesi + FX — borsapy."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


def _json_safe(d: dict | None) -> dict:
    out = {}
    for k, v in (d or {}).items():
        if hasattr(v, "item"):
            v = v.item()
        if isinstance(v, (int, float, str, bool, type(None))):
            out[k] = v
        else:
            out[k] = str(v)
    return out


class BorsapyAnalystProvider(DataProvider):
    name = "borsapy"

    async def fetch(self, *, ticker: str, **_) -> ProviderResult:
        from analyst import get_recommendation as _sync  # type: ignore[import-not-found]

        async with acquire("borsapy"):
            rec = await asyncio.to_thread(_sync, ticker)
        if not rec:
            raise RuntimeError(f"no recommendation for {ticker}")
        return ProviderResult(source=self.name, payload=_json_safe(rec))


class FxRateProvider(DataProvider):
    name = "borsapy_fx"

    async def fetch(self, *, currency: str = "USD", **_) -> ProviderResult:
        from analyst import get_fx_rate as _sync  # type: ignore[import-not-found]

        async with acquire("borsapy"):
            rate = await asyncio.to_thread(_sync, currency)
        if not rate:
            raise RuntimeError(f"no fx for {currency}")
        return ProviderResult(source=self.name, payload=_json_safe(rate))
