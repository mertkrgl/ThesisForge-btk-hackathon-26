"""sector_map.yaml loader — squad assignment lookup."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.agents.schemas import SquadType


_SECTOR_MAP_PATH = Path(__file__).resolve().parent.parent.parent / "sector_map.yaml"


@lru_cache(maxsize=1)
def load_sector_map() -> dict[str, Any]:
    if not _SECTOR_MAP_PATH.exists():
        raise FileNotFoundError(f"sector_map.yaml not found at {_SECTOR_MAP_PATH}")
    with _SECTOR_MAP_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def squad_for_ticker(ticker: str) -> SquadType:
    """Hisseden squad'a haritalama. Bulunamazsa 'Generic'."""
    upper = ticker.upper()
    sm = load_sector_map()
    for squad, cfg in sm.items():
        tickers = cfg.get("tickers") if isinstance(cfg, dict) else None
        if tickers and upper in tickers:
            return squad  # type: ignore[return-value]
    return "Generic"


def metrics_for_squad(squad: str) -> list[str]:
    sm = load_sector_map()
    cfg = sm.get(squad) or sm.get("Generic") or {}
    return list(cfg.get("metrics") or [])


def prompt_file_for_squad(squad: str) -> str:
    sm = load_sector_map()
    cfg = sm.get(squad) or sm.get("Generic") or {}
    candidate = cfg.get("prompt") or "fundamental_generic.md"
    # YAML'da kayıtlı prompt dosyası fiziksel olarak yoksa generic'e düş.
    prompts_dir = Path(__file__).resolve().parent / "prompts"
    if not (prompts_dir / candidate).exists():
        return "fundamental_generic.md"
    return candidate
