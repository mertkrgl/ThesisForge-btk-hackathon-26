"""DataProvider interface + ProviderResult — spec §9.1."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SourceType = Literal["live", "fallback", "fixture", "stub"]


class ProviderResult(BaseModel):
    """Tüm provider çıktılarının zarfı.

    `source_type` P2-A katmanı: ChainedDataProvider primary provider'ı başarıyla
    döndürürse "live"; fallback chain devreye girerse "fallback"; fixture devreye
    girerse "fixture"; embedding stub gibi yer tutucular için "stub". Confidence
    kalibrasyonu ve smoke metrikleri bu alanı okur.
    """

    model_config = ConfigDict(extra="allow")

    source: str
    payload: dict[str, Any]
    source_type: SourceType = "live"
    fetched_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


class DataProvider(ABC):
    """Tüm provider'lar bu interface'i implement eder."""

    name: str = "<unset>"

    @abstractmethod
    async def fetch(self, **kwargs) -> ProviderResult:  # pragma: no cover - abstract
        raise NotImplementedError


class DataUnavailable(Exception):
    """Tüm provider chain ve fixture başarısız olduğunda raise edilir."""
