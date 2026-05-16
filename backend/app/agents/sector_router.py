"""Sector Router — sector_map.yaml lookup, deterministic (LLM fallback kaldırıldı).

LLM fallback rapor §1.4'te dead code olarak işaretlendi: LLM yine
`select_squad` tool'unu çağırıp YAML'a bakıyor, hep "Generic" döndürüyor
ve 3-5s harcıyor. Sıfır bilgi katmıyor → kaldırıldı.
"""
from __future__ import annotations

from app.agents.schemas import SectorAssignment
from app.agents.sector_map import load_sector_map, squad_for_ticker
from app.agents.tools import AgentContext


async def run_sector_router(ctx: AgentContext, ticker: str) -> SectorAssignment:
    """YAML'da varsa squad; yoksa Generic."""
    upper = ticker.upper()

    sm = load_sector_map()
    for squad, cfg in sm.items():
        tickers = cfg.get("tickers") if isinstance(cfg, dict) else None
        if tickers and upper in tickers:
            return SectorAssignment(ticker=upper, squad=squad, confidence=95.0)  # type: ignore[arg-type]

    return SectorAssignment(
        ticker=upper, squad=squad_for_ticker(upper), confidence=60.0
    )
