"""Disk fixture store — `backend/fixtures/<domain>/<key>.json`.

Demo killswitch ve provider chain'in son halkası buraya düşer.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logging import log
from app.data.providers.base import ProviderResult


# Anahtar şeması: `<domain>:<TICKER>[:modifier]` veya `<domain>:latest`
# Dosya yolu: `<FIXTURE_ROOT>/<domain>/<rest>.json`
def _key_to_path(key: str) -> Path:
    parts = key.split(":")
    if not parts:
        raise ValueError(f"empty fixture key: {key}")
    domain = parts[0]
    rest = "_".join(parts[1:]) if len(parts) > 1 else "latest"
    rest = rest.replace("/", "_").replace(" ", "_")
    return settings.FIXTURE_ROOT / domain / f"{rest}.json"


def _read_sync(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("fixture_read_fail", path=str(path), error=str(e))
        return None


def _write_sync(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


async def read_fixture(key: str) -> ProviderResult | None:
    """Disk fixture varsa ProviderResult olarak döndür, yoksa None."""
    path = _key_to_path(key)
    data = await asyncio.to_thread(_read_sync, path)
    if data is None:
        return None
    try:
        return ProviderResult(
            source=data.get("provider", "fixture"),
            payload=data.get("payload", {}),
            fetched_at=data.get("fetched_at", ""),
            source_type="fixture",
        )
    except Exception as e:
        log.warning("fixture_parse_fail", path=str(path), error=str(e))
        return None


async def write_fixture(
    key: str, result: ProviderResult, *, ttl_hours: int | None = None
) -> Path:
    """refresh_fixtures.py için disk write."""
    path = _key_to_path(key)
    payload = {
        "key": key,
        "provider": result.source,
        "fetched_at": result.fetched_at,
        "ttl_hours": ttl_hours,
        "payload": result.payload,
    }
    await asyncio.to_thread(_write_sync, path, payload)
    return path
