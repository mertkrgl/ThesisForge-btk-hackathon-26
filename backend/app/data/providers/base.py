"""DataProvider interface + ProviderResult — spec §9.1."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProviderResult(BaseModel):
    """Tüm provider çıktılarının zarfı."""

    model_config = ConfigDict(extra="allow")

    source: str
    payload: dict[str, Any]
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
