"""Sector Router — sector_map.yaml primary, LLM fallback."""
from __future__ import annotations

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import SectorAssignment
from app.agents.sector_map import load_sector_map, squad_for_ticker
from app.agents.strands_tools import SECTOR_ROUTER_TOOLS
from app.agents.tools import AgentContext
from app.core.logging import log


def _agent():
    return build_agent(
        name="sector_router",
        system_prompt=read_prompt("sector_router.md"),
        tools=SECTOR_ROUTER_TOOLS,
        use_pro=False,
        structured_output_model=SectorAssignment,
    )


async def run_sector_router(ctx: AgentContext, ticker: str) -> SectorAssignment:
    """Rule-based primary; haritada yoksa LLM fallback."""
    ctx = ctx.with_agent("sector_router")
    upper = ticker.upper()

    sm = load_sector_map()
    for squad, cfg in sm.items():
        tickers = cfg.get("tickers") if isinstance(cfg, dict) else None
        if tickers and upper in tickers:
            return SectorAssignment(ticker=upper, squad=squad, confidence=95.0)  # type: ignore[arg-type]

    # Fallback: LLM (yine de güvensiz, generic'e düşürelim)
    try:
        agent = _agent()
        out = await run_agent_with_context(
            agent,
            f"Ticker {upper} için squad seç.",
            ctx,
            output_model=SectorAssignment,
        )
        if isinstance(out, SectorAssignment):
            return out
        return SectorAssignment.model_validate(out)
    except Exception as e:
        log.warning("sector_router_fail", ticker=upper, error=str(e)[:200])
        return SectorAssignment(
            ticker=upper, squad=squad_for_ticker(upper), confidence=60.0
        )
