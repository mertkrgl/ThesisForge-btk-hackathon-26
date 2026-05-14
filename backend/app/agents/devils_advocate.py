"""Devil's Advocate — Pro model, karşı argüman + base rate uyarısı."""
from __future__ import annotations

import json

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import Critique, FundamentalAnalysis, MemoryHit, TechnicalAnalysis
from app.agents.strands_tools import DEVILS_ADVOCATE_TOOLS
from app.agents.tools import AgentContext
from app.core.logging import log


def _agent():
    return build_agent(
        name="devils_advocate",
        system_prompt=read_prompt("devils_advocate.md"),
        tools=DEVILS_ADVOCATE_TOOLS,
        use_pro=True,
        structured_output_model=Critique,
    )


def _empty() -> Critique:
    return Critique(
        technical_pushback=[],
        fundamental_pushback=[],
        cross_cutting_risks=["Devil's Advocate çalışmadı; risk değerlendirmesi eksik."],
        base_rate_warnings=[],
        overall_critique_strength=50,
    )


def _build_prompt(
    ticker: str,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    memory_hits: list[MemoryHit] | None,
) -> str:
    parts = [
        f"Ticker: {ticker}",
        f"Squad: {fund.squad}",
        "",
        "## Technical worker özeti",
        json.dumps(tech.model_dump(mode="json"), ensure_ascii=False, indent=2)[:1500],
        "",
        "## Fundamental worker özeti",
        json.dumps(fund.model_dump(mode="json"), ensure_ascii=False, indent=2)[:1500],
    ]
    if memory_hits:
        parts.append("")
        parts.append("## Geçmiş benzer tezler")
        for h in memory_hits[:3]:
            parts.append(
                f"- {h.ticker} {h.thesis_date} outcome={h.outcome} "
                f"ret={h.ground_truth_return} :: {h.summary[:160]}"
            )
    parts.append("")
    parts.append(
        "Yukarıdaki tezin zayıf taraflarını ve geçmiş base rate verisiyle "
        "olası tuzakları öne çıkar. 3 tool'u kullanmayı unutma."
    )
    return "\n".join(parts)


async def run_devils_advocate(
    ctx: AgentContext,
    ticker: str,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    memory_hits: list[MemoryHit] | None = None,
) -> Critique:
    """Karşı-argüman üret. Hata olursa nötr fallback."""
    ctx = ctx.with_agent("devils_advocate")
    upper = ticker.upper()
    try:
        agent = _agent()
        prompt = _build_prompt(upper, tech, fund, memory_hits)
        out = await run_agent_with_context(
            agent, prompt, ctx, output_model=Critique
        )
        if isinstance(out, Critique):
            return out
        return Critique.model_validate(out)
    except Exception as e:
        log.warning("devils_advocate_fail", ticker=upper, error=str(e)[:200])
        return _empty()
