"""Fundamental Worker — squad'a özgü prompt seçimiyle, Flash model."""
from __future__ import annotations

from typing import cast

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import FundamentalAnalysis, SquadType
from app.agents.sector_map import prompt_file_for_squad
from app.agents.strands_tools import FUNDAMENTAL_TOOLS
from app.agents.tools import AgentContext
from app.core.logging import log


def _agent(squad: str):
    """Squad'a göre system_prompt değişen fresh Agent."""
    prompt_filename = prompt_file_for_squad(squad)
    return build_agent(
        name=f"fundamental_worker_{squad.lower()}",
        system_prompt=read_prompt(prompt_filename),
        tools=FUNDAMENTAL_TOOLS,
        use_pro=False,
        structured_output_model=FundamentalAnalysis,
    )


def _empty(ticker: str, squad: str) -> FundamentalAnalysis:
    return FundamentalAnalysis(
        ticker=ticker.upper(),
        squad=cast(SquadType, squad if squad in {"Banking", "Energy", "Defense", "Retail", "RealEstate", "Generic"} else "Generic"),
        summary="Fundamental veriler şu anda alınamadı.",
        key_metrics_json="{}",
        peer_compare_json="{}",
        notable_observations=[],
        fundamental_score=50,
    )


async def run_fundamental_worker(
    ctx: AgentContext, ticker: str, squad: str = "Generic"
) -> FundamentalAnalysis:
    """Squad'a özgü prompt ile fundamental analiz; hata olursa nötr fallback."""
    ctx = ctx.with_agent("fundamental_worker")
    upper = ticker.upper()
    try:
        agent = _agent(squad)
        out = await run_agent_with_context(
            agent,
            f"{upper} (squad={squad}) için fundamental analiz üret. "
            f"Tüm 6 tool'u sırayla çağır.",
            ctx,
            output_model=FundamentalAnalysis,
        )
        if isinstance(out, FundamentalAnalysis):
            if out.ticker.upper() != upper:
                out = out.model_copy(update={"ticker": upper})
            return out
        return FundamentalAnalysis.model_validate(out)
    except Exception as e:
        log.warning(
            "fundamental_worker_fail",
            ticker=upper,
            squad=squad,
            error=str(e)[:200],
        )
        return _empty(upper, squad)
