"""ChainedDataProvider + global registry — domain bazında provider zinciri."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from app.core.logging import log
from app.data.cache import CacheBackend, get_cache_backend
from app.data.fixture import read_fixture
from app.data.providers.base import DataProvider, DataUnavailable, ProviderResult


def _today_utc() -> str:
    """Cache anahtarına gömülen gün etiketi (UTC).

    Aynı UTC günü içinde fundamental veriler için cache hit garanti edilir;
    ertesi gün anahtar değişir → fresh fetch. Demo sırasında aynı ticker'ın
    iki kez çalıştırılması arasında ROE/EBITDA değerlerinin sapmasını
    engeller (rapor §2.3'teki MEPET çelişkisinin bir kanadı).
    """
    return datetime.now(timezone.utc).strftime("%Y%m%d")


FixtureKeyFn = Callable[..., str]


class ChainedDataProvider:
    """primary → secondary → ... → fixture sırasıyla dener.

    Çağrıda kwargs hem her provider'a hem fixture_key_fn'e iletilir.
    """

    def __init__(
        self,
        providers: list[DataProvider],
        fixture_key_fn: FixtureKeyFn,
        *,
        cache: CacheBackend | None = None,
        cache_ttl: int | None = None,
        domain: str = "<unknown>",
    ):
        self.providers = providers
        self.fixture_key_fn = fixture_key_fn
        self.cache = cache
        self.cache_ttl = cache_ttl
        self.domain = domain

    async def fetch(self, **kwargs) -> ProviderResult:
        key = self.fixture_key_fn(**kwargs)

        # ─── Cache check
        if self.cache is not None:
            cached = await self.cache.get(key)
            if cached is not None:
                log.info("cache_hit", domain=self.domain, key=key)
                return ProviderResult(**cached)

        # ─── Provider chain
        last_err: Exception | None = None
        for provider in self.providers:
            try:
                result = await provider.fetch(**kwargs)
                if self.cache is not None and self.cache_ttl:
                    await self.cache.set(
                        key, result.model_dump(), self.cache_ttl
                    )
                log.info(
                    "provider_hit",
                    domain=self.domain,
                    key=key,
                    source=result.source,
                )
                return result
            except Exception as e:
                last_err = e
                log.warning(
                    "provider_fail",
                    domain=self.domain,
                    provider=getattr(provider, "name", type(provider).__name__),
                    error=str(e)[:200],
                )

        # ─── Fixture fallback
        fx = await read_fixture(key)
        if fx is not None:
            log.info("fixture_hit", domain=self.domain, key=key)
            return fx

        raise DataUnavailable(
            f"All providers + fixture failed for {self.domain}:{key}"
        ) from last_err


# ───────────────────────── Global registry ─────────────────────────

_REGISTRY: dict[str, ChainedDataProvider] | None = None


def build_registry() -> dict[str, ChainedDataProvider]:
    """Lazy build — provider modüllerini ilk kullanıma kadar import etmez."""
    from app.data.providers.macro import TCMBMacroProvider
    from app.data.providers.prices import (
        YFinancePriceProvider,
        IsyatirimPriceProvider,
        IndexProvider,
        DividendProvider,
        BrentOilProvider,
    )
    from app.data.providers.financials import IsyatirimFinancialsProvider, RatiosProvider
    from app.data.providers.disclosures import (
        MkkDisclosuresProvider,
        PykapDisclosuresProvider,
        CompanyDisclosuresProvider,
    )
    from app.data.providers.technicals import PandasTaTechnicalsProvider
    from app.data.providers.analyst import BorsapyAnalystProvider, FxRateProvider
    from app.data.providers.news import GoogleCompanyNewsProvider, GoogleMarketNewsProvider
    from app.data.providers.companies import MkkCompaniesProvider, CompanyLookupProvider
    from app.data.providers.thesis_bundle import ThesisBundleProvider

    cache = get_cache_backend()

    return {
        "price": ChainedDataProvider(
            [YFinancePriceProvider(), IsyatirimPriceProvider()],
            fixture_key_fn=lambda ticker, days=90, **_: f"price:{ticker.upper()}:ohlcv:{days}d",
            cache=cache,
            cache_ttl=15 * 60,
            domain="price",
        ),
        "index": ChainedDataProvider(
            [IndexProvider()],
            fixture_key_fn=lambda index_code="XU100", days=90, **_: f"index:{index_code.upper()}:{days}d",
            cache=cache,
            cache_ttl=15 * 60,
            domain="index",
        ),
        "dividend": ChainedDataProvider(
            [DividendProvider()],
            fixture_key_fn=lambda ticker, **_: f"dividend:{ticker.upper()}",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="dividend",
        ),
        "brent": ChainedDataProvider(
            [BrentOilProvider()],
            fixture_key_fn=lambda days=30, **_: f"brent:{days}d",
            cache=cache,
            cache_ttl=15 * 60,
            domain="brent",
        ),
        "financials": ChainedDataProvider(
            [IsyatirimFinancialsProvider()],
            fixture_key_fn=lambda ticker, years=2, **_: f"fin:{ticker.upper()}:{years}y:{_today_utc()}",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="financials",
        ),
        "ratios": ChainedDataProvider(
            [RatiosProvider()],
            fixture_key_fn=lambda ticker, **_: f"ratios:{ticker.upper()}:{_today_utc()}",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="ratios",
        ),
        "kap_recent": ChainedDataProvider(
            [MkkDisclosuresProvider()],
            fixture_key_fn=lambda count=20, **_: f"kap:recent:{count}",
            cache=cache,
            cache_ttl=3600,
            domain="kap_recent",
        ),
        "kap_company": ChainedDataProvider(
            [CompanyDisclosuresProvider(), PykapDisclosuresProvider()],
            fixture_key_fn=lambda ticker, days=30, **_: f"kap:{ticker.upper()}:{days}d",
            cache=cache,
            cache_ttl=3600,
            domain="kap_company",
        ),
        "technicals": ChainedDataProvider(
            [PandasTaTechnicalsProvider()],
            fixture_key_fn=lambda ticker, days=90, **_: f"technicals:{ticker.upper()}:{days}d",
            cache=cache,
            cache_ttl=15 * 60,
            domain="technicals",
        ),
        "analyst": ChainedDataProvider(
            [BorsapyAnalystProvider()],
            fixture_key_fn=lambda ticker, **_: f"analyst:{ticker.upper()}",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="analyst",
        ),
        "fx": ChainedDataProvider(
            [FxRateProvider()],
            fixture_key_fn=lambda currency="USD", **_: f"fx:{currency.upper()}",
            cache=cache,
            cache_ttl=15 * 60,
            domain="fx",
        ),
        "macro": ChainedDataProvider(
            [TCMBMacroProvider()],
            fixture_key_fn=lambda **_: "macro:latest",
            cache=cache,
            cache_ttl=15 * 60,
            domain="macro",
        ),
        "news_company": ChainedDataProvider(
            [GoogleCompanyNewsProvider()],
            fixture_key_fn=lambda ticker, count=10, **_: f"news:{ticker.upper()}:{count}",
            cache=cache,
            cache_ttl=3600,
            domain="news_company",
        ),
        "news_market": ChainedDataProvider(
            [GoogleMarketNewsProvider()],
            fixture_key_fn=lambda count=10, **_: f"news:market:{count}",
            cache=cache,
            cache_ttl=3600,
            domain="news_market",
        ),
        "companies": ChainedDataProvider(
            [MkkCompaniesProvider()],
            fixture_key_fn=lambda **_: "companies:bist:all",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="companies",
        ),
        "company_lookup": ChainedDataProvider(
            [CompanyLookupProvider()],
            fixture_key_fn=lambda ticker, **_: f"company:{ticker.upper()}",
            cache=cache,
            cache_ttl=24 * 3600,
            domain="company_lookup",
        ),
        "thesis_bundle": ChainedDataProvider(
            [ThesisBundleProvider()],
            fixture_key_fn=lambda ticker, days=90, **_: f"thesis_bundle:{ticker.upper()}:{days}d",
            cache=cache,
            cache_ttl=15 * 60,
            domain="thesis_bundle",
        ),
    }


def get_registry() -> dict[str, ChainedDataProvider]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = build_registry()
    return _REGISTRY


def reset_registry() -> None:
    """Test fixture'ı için."""
    global _REGISTRY
    _REGISTRY = None
