"""Aşama 7 — Workers + Devil's Advocate (mocked Strands Agent)."""
from __future__ import annotations

import uuid

import pytest

from app.agents import devils_advocate as dac
from app.agents import fundamental_worker as fw
from app.agents import technical_worker as tw
from app.agents.schemas import (
    Critique,
    FundamentalAnalysis,
    KeyLevels,
    Observation,
    TechnicalAnalysis,
)
from app.agents.tools import AgentContext


def _ctx() -> AgentContext:
    """Async-safe AgentContext stub (DB session yok — agent fail path test
    edilirken kullanılır, mock path'ta session zaten dokunulmaz)."""
    return AgentContext(
        thesis_id=uuid.uuid4(),
        agent_id="test",
        session=None,  # type: ignore[arg-type]
    )


# ─── Technical worker ────────────────────────────────────────────────


async def test_technical_worker_returns_pydantic(monkeypatch):
    expected = TechnicalAnalysis(
        ticker="ASELS",
        trend_short="bullish",
        trend_long="neutral",
        key_levels=KeyLevels(support=[140.0], resistance=[160.0]),
        momentum_score=72,
        patterns_detected=["golden_cross_yaklaşıyor"],
        notable_observations=[
            Observation(
                text="RSI 67 seviyesinde",
                citation_call_id=str(uuid.uuid4()),
                confidence=80.0,
            )
        ],
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return expected

    monkeypatch.setattr(tw, "run_agent_with_context", fake_run)
    monkeypatch.setattr(tw, "_agent", lambda: object())

    out = await tw.run_technical_worker(_ctx(), "ASELS")
    assert out.ticker == "ASELS"
    assert out.momentum_score == 72
    assert out.trend_short == "bullish"


async def test_technical_worker_fallback_on_exception(monkeypatch):
    async def boom(*a, **kw):
        raise RuntimeError("gemini 429")

    monkeypatch.setattr(tw, "run_agent_with_context", boom)
    monkeypatch.setattr(tw, "_agent", lambda: object())

    out = await tw.run_technical_worker(_ctx(), "asels")
    assert out.ticker == "ASELS"
    assert out.trend_short == "neutral"
    assert out.momentum_score == 50  # nötr


# ─── Fundamental worker ──────────────────────────────────────────────


async def test_fundamental_worker_picks_squad_prompt(monkeypatch):
    captured: dict[str, str] = {}

    def fake_build_agent(*, name, system_prompt, tools, use_pro, structured_output_model):
        captured["prompt"] = system_prompt
        captured["name"] = name
        return object()

    expected = FundamentalAnalysis(
        ticker="GARAN",
        squad="Banking",
        summary="özet",
        key_metrics_json='{"NIM": 4.2}',
        peer_compare_json="{}",
        notable_observations=[],
        fundamental_score=70,
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return expected

    monkeypatch.setattr(fw, "build_agent", fake_build_agent)
    monkeypatch.setattr(fw, "run_agent_with_context", fake_run)

    out = await fw.run_fundamental_worker(_ctx(), "GARAN", squad="Banking")
    assert out.squad == "Banking"
    assert "Banking" in captured["prompt"]  # banking prompt'u yüklendi
    assert "NIM" in captured["prompt"]
    assert "banking" in captured["name"].lower()


async def test_fundamental_worker_fallback_on_exception(monkeypatch):
    async def boom(*a, **kw):
        raise RuntimeError("fail")

    monkeypatch.setattr(fw, "run_agent_with_context", boom)
    monkeypatch.setattr(fw, "_agent", lambda squad: object())

    out = await fw.run_fundamental_worker(_ctx(), "XYZW", squad="Generic")
    assert out.ticker == "XYZW"
    assert out.squad == "Generic"
    assert out.fundamental_score == 50


# ─── Devil's Advocate ────────────────────────────────────────────────


async def test_devils_advocate_returns_critique(monkeypatch):
    expected = Critique(
        technical_pushback=["RSI aşırı alım yakın"],
        fundamental_pushback=["Peer P/E ortalamasının üzerinde"],
        cross_cutting_risks=["Makro: politika faizi belirsiz", "Regülasyon riski"],
        base_rate_warnings=["Defense backlog sürprizleri tarihsel olarak %40 oranında hayal kırıklığı"],
        overall_critique_strength=65,
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return expected

    monkeypatch.setattr(dac, "run_agent_with_context", fake_run)
    monkeypatch.setattr(dac, "_agent", lambda: object())

    tech = TechnicalAnalysis(
        ticker="ASELS",
        trend_short="bullish",
        trend_long="bullish",
        key_levels=KeyLevels(),
        momentum_score=72,
    )
    fund = FundamentalAnalysis(
        ticker="ASELS",
        squad="Defense",
        summary="x",
        fundamental_score=68,
    )

    out = await dac.run_devils_advocate(_ctx(), "ASELS", tech, fund, memory_hits=[])
    assert out.overall_critique_strength == 65
    assert len(out.cross_cutting_risks) == 2


async def test_devils_advocate_fallback_on_exception(monkeypatch):
    async def boom(*a, **kw):
        raise RuntimeError("rate limit")

    monkeypatch.setattr(dac, "run_agent_with_context", boom)
    monkeypatch.setattr(dac, "_agent", lambda: object())

    tech = TechnicalAnalysis(
        ticker="X",
        trend_short="neutral",
        trend_long="neutral",
        key_levels=KeyLevels(),
        momentum_score=50,
    )
    fund = FundamentalAnalysis(ticker="X", squad="Generic", summary="", fundamental_score=50)
    out = await dac.run_devils_advocate(_ctx(), "X", tech, fund)
    assert out.overall_critique_strength == 50
    assert out.cross_cutting_risks  # nötr boş değil — uyarı var
