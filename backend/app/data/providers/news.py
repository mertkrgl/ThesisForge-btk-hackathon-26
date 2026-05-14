"""Haber sağlayıcıları — Google News RSS (şirket-spesifik) + makro."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


class GoogleCompanyNewsProvider(DataProvider):
    name = "google_news_company"

    async def fetch(
        self,
        *,
        ticker: str,
        count: int = 10,
        with_summary: bool = False,
        **_,
    ) -> ProviderResult:
        from news import get_company_news as _sync  # type: ignore[import-not-found]

        async with acquire("google_news"):
            items = await asyncio.to_thread(_sync, ticker, count, with_summary)
        return ProviderResult(
            source=self.name,
            payload={"ticker": ticker.upper(), "count": len(items), "news": items},
        )


class GoogleMarketNewsProvider(DataProvider):
    name = "google_news_market"

    async def fetch(self, *, count: int = 10, **_) -> ProviderResult:
        from news import get_market_news as _sync  # type: ignore[import-not-found]

        async with acquire("google_news"):
            items = await asyncio.to_thread(_sync, count)
        return ProviderResult(
            source=self.name,
            payload={"count": len(items), "news": items},
        )
