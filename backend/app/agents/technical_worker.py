"""Technical Worker — RSI/MACD/SR/RS bazlı teknik analiz, Flash model."""
from __future__ import annotations

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import KeyLevels, TechnicalAnalysis
from app.agents.strands_tools import TECHNICAL_TOOLS
from app.agents.tools import AgentContext
from app.core.logging import log


def _agent():
    return build_agent(
        name="technical_worker",
        system_prompt=read_prompt("technical_worker.md"),
        tools=TECHNICAL_TOOLS,
        use_pro=False,
        structured_output_model=TechnicalAnalysis,
    )


def _empty(ticker: str) -> TechnicalAnalysis:
    return TechnicalAnalysis(
        ticker=ticker.upper(),
        trend_short="neutral",
        trend_long="neutral",
        key_levels=KeyLevels(),
        momentum_score=50,
        patterns_detected=[],
        notable_observations=[],
    )


async def run_technical_worker(ctx: AgentContext, ticker: str) -> TechnicalAnalysis:
    """Teknik analiz üret. Hata olursa nötr fallback döndür."""
    ctx = ctx.with_agent("technical_worker")
    upper = ticker.upper()
    try:
        agent = _agent()
        out = await run_agent_with_context(
            agent,
            f"{upper} için teknik analiz üret. Tüm 5 tool'u sırayla çağır.",
            ctx,
            output_model=TechnicalAnalysis,
        )
        if isinstance(out, TechnicalAnalysis):
            # ticker'ı garantiye al
            if out.ticker.upper() != upper:
                out = out.model_copy(update={"ticker": upper})
            return out
        return TechnicalAnalysis.model_validate(out)
    except Exception as e:
        log.warning("technical_worker_fail", ticker=upper, error=str(e)[:200])
        return _empty(upper)
