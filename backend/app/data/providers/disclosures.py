"""KAP bildirimleri — MKK API primary, pykap fallback."""
from __future__ import annotations

import asyncio

from app.core.paths import ensure_product_path
from app.data.providers.base import DataProvider, ProviderResult
from app.data.ratelimit import acquire

ensure_product_path()


class MkkDisclosuresProvider(DataProvider):
    """Genel piyasa son N KAP bildirimi."""

    name = "mkk_recent"

    async def fetch(self, *, count: int = 20, **_) -> ProviderResult:
        from disclosures import get_latest_disclosures as _sync  # type: ignore[import-not-found]

        async with acquire("mkk"):
            items = await asyncio.to_thread(_sync, count)
        return ProviderResult(
            source=self.name,
            payload={"count": len(items or []), "disclosures": items or []},
        )


class CompanyDisclosuresProvider(DataProvider):
    """Şirkete özel KAP bildirimleri — pykap."""

    name = "pykap_company"

    async def fetch(self, *, ticker: str, days: int = 30, **_) -> ProviderResult:
        from disclosures import get_company_disclosures as _sync  # type: ignore[import-not-found]

        async with acquire("pykap"):
            items = await asyncio.to_thread(_sync, ticker, days)
        # pykap dict-like; her item'i serialize edilebilir hale getir
        clean = []
        for d in items or []:
            if isinstance(d, dict):
                clean.append({k: str(v) if v is not None else None for k, v in d.items()})
            else:
                clean.append(str(d))
        return ProviderResult(
            source=self.name,
            payload={"ticker": ticker.upper(), "count": len(clean), "disclosures": clean},
        )


class PykapDisclosuresProvider(DataProvider):
    """Şirket için ek finansal rapor parse (pykap)."""

    name = "pykap_reports"

    async def fetch(self, *, ticker: str, **_) -> ProviderResult:
        from disclosures import get_company_financial_reports as _sync  # type: ignore[import-not-found]

        async with acquire("pykap"):
            data = await asyncio.to_thread(_sync, ticker)
        return ProviderResult(
            source=self.name,
            payload={"ticker": ticker.upper(), "reports": data or {}},
        )
