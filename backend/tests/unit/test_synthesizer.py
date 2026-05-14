"""Aşama 7 — Synthesizer + ConfidenceBreakdown (mocked LLM)."""
from __future__ import annotations

import re
import uuid

import pytest

from app.agents import synthesizer as synth
from app.agents.confidence import compute_confidence, memory_base_rate
from app.agents.schemas import (
    BullBearPoint,
    Catalyst,
    Critique,
    FundamentalAnalysis,
    KeyLevels,
    MacroContextOutput,
    MemoryHit,
    TechnicalAnalysis,
    ThesisStructured,
)
from app.agents.tools import AgentContext


def _ctx() -> AgentContext:
    return AgentContext(
        thesis_id=uuid.uuid4(), agent_id="test", session=None  # type: ignore[arg-type]
    )


# ─── Confidence formula ──────────────────────────────────────────────


def test_confidence_raw_known_inputs():
    b = compute_confidence(
        data_quality=80,
        technical=65,
        fundamental=75,
        news_macro=60,
        memory_base=70,
        devil_inverse=50,
        user_mode="default",
    )
    # 0.25*80 + 0.20*65 + 0.20*75 + 0.15*60 + 0.10*70 + 0.10*50
    # = 20 + 13 + 15 + 9 + 7 + 5 = 69
    assert b.computed_raw == pytest.approx(69.0, abs=0.05)
    assert b.applied_cap is None
    assert b.final == pytest.approx(69.0, abs=0.05)


def test_confidence_conservative_cap():
    b = compute_confidence(
        data_quality=95,
        technical=90,
        fundamental=88,
        news_macro=70,
        memory_base=80,
        devil_inverse=60,
        user_mode="conservative",
    )
    assert b.computed_raw > 70
    assert b.applied_cap == 70.0
    assert b.final == 70.0


def test_confidence_clips_out_of_range():
    b = compute_confidence(
        data_quality=150,  # >100, clip'lenecek
        technical=-20,  # <0, clip'lenecek
        fundamental=50,
        news_macro=50,
        memory_base=50,
        devil_inverse=50,
    )
    assert b.data_quality == 100.0
    assert b.technical == 0.0


def test_memory_base_rate_zero_hits_returns_neutral():
    assert memory_base_rate([]) == 50.0


def test_memory_base_rate_mixed_outcomes():
    hits = [
        MemoryHit(
            thesis_id=uuid.uuid4(),
            ticker="X",
            thesis_date="2025-01-01",
            distance=0.1,
            outcome="correct",
            ground_truth_return=10.0,
            summary="ok",
        ),
        MemoryHit(
            thesis_id=uuid.uuid4(),
            ticker="X",
            thesis_date="2025-02-01",
            distance=0.2,
            outcome="partial",
            ground_truth_return=2.0,
            summary="ok",
        ),
    ]
    assert memory_base_rate(hits) == 50.0


# ─── Synthesizer mocked ──────────────────────────────────────────────


def _make_inputs():
    cid = uuid.uuid4()
    macro = MacroContextOutput(
        paragraph="USD/TRY yatay, TÜFE %39.",
        usd_try=39.0,
        observations=[],
    )
    tech = TechnicalAnalysis(
        ticker="ASELS",
        trend_short="bullish",
        trend_long="bullish",
        key_levels=KeyLevels(support=[140.0], resistance=[170.0]),
        momentum_score=72,
    )
    fund = FundamentalAnalysis(
        ticker="ASELS",
        squad="Defense",
        summary="Backlog güçlü.",
        key_metrics={"backlog": 8000, "USD_revenue_pct": 60},
        fundamental_score=70,
    )
    critique = Critique(
        technical_pushback=["RSI aşırı alıma yakın"],
        fundamental_pushback=[],
        cross_cutting_risks=["Makro belirsizlik"],
        base_rate_warnings=[],
        overall_critique_strength=40,
    )
    conf = compute_confidence(
        data_quality=80,
        technical=72,
        fundamental=70,
        news_macro=60,
        memory_base=60,
        devil_inverse=60,
        user_mode="default",
    )
    return cid, macro, tech, fund, critique, conf


async def test_synthesizer_returns_markdown_with_citation(monkeypatch):
    cid, macro, tech, fund, critique, conf = _make_inputs()
    fake_md = (
        f"## TL;DR\nASELS güçlü teknik momentum gösteriyor [kaynak: {cid}].\n\n"
        "## Bull Case\n- Backlog 8000 milyon USD seviyesinde.\n\n"
        "## Disclaimer\nBilgi amaçlıdır.\n"
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return fake_md

    monkeypatch.setattr(synth, "run_agent_with_context", fake_run)
    monkeypatch.setattr(synth, "_synth_agent", lambda mode: object())

    md = await synth.run_synthesizer(
        _ctx(),
        ticker="ASELS",
        macro=macro,
        tech=tech,
        fund=fund,
        critique=critique,
        memory_hits=[],
        confidence_breakdown=conf,
        user_mode="default",
    )
    assert "## TL;DR" in md
    assert re.search(r"\[kaynak:\s*[a-f0-9-]{36}\]", md)


async def test_synthesizer_fallback_on_exception(monkeypatch):
    _, macro, tech, fund, critique, conf = _make_inputs()

    async def boom(*a, **kw):
        raise RuntimeError("pro 503")

    monkeypatch.setattr(synth, "run_agent_with_context", boom)
    monkeypatch.setattr(synth, "_synth_agent", lambda mode: object())

    md = await synth.run_synthesizer(
        _ctx(),
        ticker="X",
        macro=macro,
        tech=tech,
        fund=fund,
        critique=critique,
        memory_hits=[],
        confidence_breakdown=conf,
    )
    assert "Disclaimer" in md


async def test_extract_structured_returns_bull_bear_catalysts(monkeypatch):
    expected = ThesisStructured(
        bull_points=[BullBearPoint(point="Backlog güçlü", score=8)],
        bear_points=[BullBearPoint(point="Makro risk", score=5)],
        catalysts=[Catalyst(date="2026-06-15", event="Q2 earnings", impact="high")],
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return expected

    monkeypatch.setattr(synth, "run_agent_with_context", fake_run)
    monkeypatch.setattr(synth, "_extractor_agent", lambda: object())

    out = await synth.extract_structured(
        _ctx(), ticker="ASELS", thesis_md="## TL;DR\nx"
    )
    assert out.bull_points and out.bull_points[0].score == 8
    assert out.catalysts and out.catalysts[0].impact == "high"
