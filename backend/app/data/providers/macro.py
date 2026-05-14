"""TCMB EVDS makro sağlayıcısı."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


class TCMBMacroProvider(DataProvider):
    name = "tcmb"

    async def fetch(self, **_) -> ProviderResult:
        from macro import get_macro_context as _sync  # type: ignore[import-not-found]

        async with acquire("tcmb"):
            payload = await asyncio.to_thread(_sync)
        if not payload:
            raise RuntimeError("TCMB empty response")
        return ProviderResult(source=self.name, payload=dict(payload))
