"""Tek çağrıda tüm tez paketi — scripts/product/thesis_bundle wrap."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult

ensure_product_path()


def _scrub(o):
    """Tüm nested yapıyı JSON-serializable hale getir."""
    if isinstance(o, dict):
        return {k: _scrub(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_scrub(v) for v in o]
    if hasattr(o, "item"):
        try:
            return o.item()
        except Exception:
            return str(o)
    if isinstance(o, (int, float, str, bool, type(None))):
        return o
    return str(o)


class ThesisBundleProvider(DataProvider):
    name = "thesis_bundle"

    async def fetch(self, *, ticker: str, days: int = 90, **_) -> ProviderResult:
        from thesis_bundle import build_thesis_bundle as _sync  # type: ignore[import-not-found]

        bundle = await asyncio.to_thread(_sync, ticker, days)
        if not bundle:
            raise RuntimeError(f"thesis_bundle empty for {ticker}")
        return ProviderResult(source=self.name, payload=_scrub(bundle))
