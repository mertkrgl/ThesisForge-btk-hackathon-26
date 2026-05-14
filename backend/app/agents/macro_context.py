"""Macro Context Agent — TCMB + BIST + global sinyaller, tek paragraf."""
from __future__ import annotations

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import MacroContextOutput
from app.agents.strands_tools import MACRO_TOOLS
from app.agents.tools import AgentContext
from app.core.logging import log


def _agent():
    return build_agent(
        name="macro_context",
        system_prompt=read_prompt("macro_context.md"),
        tools=MACRO_TOOLS,
        use_pro=False,
        structured_output_model=MacroContextOutput,
    )


async def run_macro_context(ctx: AgentContext) -> MacroContextOutput:
    """Macro snapshot üret. Hata olursa boş paragraf döndür (orchestrator devam etsin)."""
    ctx = ctx.with_agent("macro_context")
    try:
        agent = _agent()
        out = await run_agent_with_context(
            agent,
            "Bugünkü Türkiye makro durumu için tek paragraf üret.",
            ctx,
            output_model=MacroContextOutput,
        )
        if isinstance(out, MacroContextOutput):
            return out
        # Strands structured_output dict döndürebilir
        return MacroContextOutput.model_validate(out)
    except Exception as e:
        log.warning("macro_context_fail", error=str(e)[:200])
        return MacroContextOutput(paragraph="Makro veri şu anda alınamadı.")
