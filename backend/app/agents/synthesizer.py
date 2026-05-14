"""Synthesizer — Pro model, NO tools.

Üç adım:
  1. `run_synthesizer(...)` → tam markdown tezi
  2. (Orchestrator validate eder, retry callback'i bu modülden gelir)
  3. `extract_structured(...)` → bull/bear/catalysts schema'lı çıkar (Flash, ikinci geçiş)
"""
from __future__ import annotations

import json

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import (
    ConfidenceBreakdown,
    Critique,
    FundamentalAnalysis,
    MacroContextOutput,
    MemoryHit,
    TechnicalAnalysis,
    ThesisStructured,
)
from app.agents.tools import AgentContext
from app.core.logging import log


# ───────────────────────── Agent factories ─────────────────────────


def _synth_agent(user_mode: str):
    prompt_file = (
        "synthesizer_conservative.md" if user_mode == "conservative" else "synthesizer.md"
    )
    return build_agent(
        name=f"synthesizer_{user_mode}",
        system_prompt=read_prompt(prompt_file),
        tools=[],  # NO tools
        use_pro=True,
        structured_output_model=None,  # text output
    )


def _extractor_agent():
    return build_agent(
        name="synthesizer_extractor",
        system_prompt=(
            "Sen bir markdown yatırım tezini okuyup yapılandırılmış JSON "
            "(bull_points, bear_points, catalysts) çıkaran bir asistansın. "
            "Markdown'daki `[kaynak: <uuid>]` etiketlerini call_id olarak "
            "BullBearPoint/Catalyst alanına eşle; eşleşmeyenler için call_id=None bırak. "
            "Her bull/bear için 0-10 arası `score` ata (sayısal güçlü iddialar yüksek). "
            "Tool çağırma."
        ),
        tools=[],
        use_pro=False,
        structured_output_model=ThesisStructured,
    )


# ───────────────────────── Prompt builders ─────────────────────────


def _serialize_for_context(obj) -> str:
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), ensure_ascii=False, indent=2)
    return json.dumps(obj, ensure_ascii=False, indent=2, default=str)


def _build_user_prompt(
    *,
    ticker: str,
    macro: MacroContextOutput,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    critique: Critique,
    memory_hits: list[MemoryHit],
    confidence_breakdown: ConfidenceBreakdown,
    user_mode: str,
    feedback: str | None = None,
) -> str:
    parts = [
        f"# Tez bağlamı — {ticker}",
        f"user_mode: {user_mode}",
        "",
        "## Macro Context",
        _serialize_for_context(macro)[:1800],
        "",
        "## Technical Analysis",
        _serialize_for_context(tech)[:1800],
        "",
        "## Fundamental Analysis",
        _serialize_for_context(fund)[:2200],
        "",
        "## Devil's Advocate Critique",
        _serialize_for_context(critique)[:1500],
        "",
        "## Memory Hits (geçmiş benzer tezler)",
        _serialize_for_context([h.model_dump(mode="json") for h in memory_hits])[:1500],
        "",
        "## Confidence Breakdown",
        _serialize_for_context(confidence_breakdown)[:800],
        "",
    ]
    if feedback:
        parts.extend(
            [
                "## ⚠️ Validator geri bildirimi (1. denemeden)",
                feedback,
                "",
                "Lütfen yalnızca yukarıda verilen `observations[].citation_call_id` "
                "değerlerinden gelen UUID'leri kullanarak tezi yeniden yaz.",
                "",
            ]
        )

    parts.append(
        f"Şimdi {ticker} için yatırım tezini Türkçe markdown olarak yaz. "
        "Her sayısal/aktarılan claim'in sonunda `[kaynak: <uuid>]` etiketi olmalı; "
        "UUID'leri yalnızca yukarıdaki observations'lardan al, asla uydurma."
    )
    return "\n".join(parts)


# ───────────────────────── Public API ─────────────────────────


_FALLBACK_MD = (
    "## TL;DR\nSentez ajanı çalışamadı; özet üretilemedi.\n\n"
    "## Disclaimer\nBu içerik bilgi amaçlıdır; yatırım tavsiyesi değildir.\n"
)


async def run_synthesizer(
    ctx: AgentContext,
    *,
    ticker: str,
    macro: MacroContextOutput,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    critique: Critique,
    memory_hits: list[MemoryHit],
    confidence_breakdown: ConfidenceBreakdown,
    user_mode: str = "default",
    feedback: str | None = None,
) -> str:
    """Tek markdown tezi üret. Hata olursa minimal fallback markdown."""
    ctx = ctx.with_agent("synthesizer")
    upper = ticker.upper()
    try:
        agent = _synth_agent(user_mode)
        prompt = _build_user_prompt(
            ticker=upper,
            macro=macro,
            tech=tech,
            fund=fund,
            critique=critique,
            memory_hits=memory_hits,
            confidence_breakdown=confidence_breakdown,
            user_mode=user_mode,
            feedback=feedback,
        )
        out = await run_agent_with_context(agent, prompt, ctx, output_model=None)
        # Strands text response: str veya AgentResult; .message veya str() ile çıkar
        if isinstance(out, str):
            return out
        # AgentResult benzeri obje
        for attr in ("message", "output", "text"):
            v = getattr(out, attr, None)
            if isinstance(v, str) and v.strip():
                return v
        return str(out)
    except Exception as e:
        log.warning("synthesizer_fail", ticker=upper, error=str(e)[:200])
        return _FALLBACK_MD


async def extract_structured(
    ctx: AgentContext, *, ticker: str, thesis_md: str
) -> ThesisStructured:
    """Markdown'dan bull/bear/catalysts schema'lı listelere geç. Flash."""
    ctx = ctx.with_agent("synthesizer")
    try:
        agent = _extractor_agent()
        prompt = (
            f"Ticker: {ticker.upper()}\n\n"
            f"Aşağıdaki markdown'dan bull_points, bear_points ve catalysts'i çıkar:\n\n"
            f"{thesis_md}"
        )
        out = await run_agent_with_context(
            agent, prompt, ctx, output_model=ThesisStructured
        )
        if isinstance(out, ThesisStructured):
            return out
        return ThesisStructured.model_validate(out)
    except Exception as e:
        log.warning(
            "synthesizer_extract_fail",
            ticker=ticker.upper(),
            error=str(e)[:200],
        )
        return ThesisStructured()
