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
        momentum_score=0,  # LLM artık baseline 0 verir; Python override eder
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

    # Rapor §1.2: momentum DB tool sonuçlarından Python ile hesaplanıyor.
    # RSI 67 (delta +17), MACD pozitif (+10), RS +6% (+15) → 50+42 = 92
    async def fake_fetch(ctx, ticker):
        return (
            {"indicators": {"rsi_14": 67.0, "macd_hist": 0.5}},
            {"relative_strength_pct": 6.0},
        )

    monkeypatch.setattr(tw, "run_agent_with_context", fake_run)
    monkeypatch.setattr(tw, "_agent", lambda: object())
    monkeypatch.setattr(tw, "_fetch_indicator_payloads", fake_fetch)

    out = await tw.run_technical_worker(_ctx(), "ASELS")
    assert out.ticker == "ASELS"
    assert out.momentum_score == 92  # 50 + 17 + 10 + 15
    assert out.trend_short == "bullish"


async def test_technical_worker_momentum_bearish(monkeypatch):
    """Bearish hisse: RSI 36 (-14), MACD negatif (-10), RS -8% (-15) → 50-39 = 11."""
    expected = TechnicalAnalysis(
        ticker="MEPET",
        trend_short="bearish",
        trend_long="bearish",
        key_levels=KeyLevels(),
        momentum_score=0,
        patterns_detected=[],
        notable_observations=[],
    )

    async def fake_run(agent, prompt, ctx, *, output_model=None):
        return expected

    async def fake_fetch(ctx, ticker):
        return (
            {"indicators": {"rsi_14": 36.0, "macd_hist": -0.3}},
            {"relative_strength_pct": -8.0},
        )

    monkeypatch.setattr(tw, "run_agent_with_context", fake_run)
    monkeypatch.setattr(tw, "_agent", lambda: object())
    monkeypatch.setattr(tw, "_fetch_indicator_payloads", fake_fetch)

    out = await tw.run_technical_worker(_ctx(), "MEPET")
    # Rapor §1.2 düzeltmesi: bearish patolojik 0-1 yerine makul 11
    assert out.momentum_score == 11
    assert out.momentum_score > 0  # patolojik dipleme yok


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


def test_fundamental_analysis_invalid_json_fallback():
    fa = FundamentalAnalysis(
        ticker="TEST",
        squad="Generic",
        summary="dummy",
        key_metrics_json="{'invalid': True,}",  # single quote + trailing comma
        peer_compare_json="not json at all",
        fundamental_score=50,
    )
    assert fa.key_metrics_json == "{}"
    assert fa.peer_compare_json == "{}"


def test_fundamental_analysis_valid_json_preserved():
    fa = FundamentalAnalysis(
        ticker="TEST",
        squad="Banking",
        summary="dummy",
        key_metrics_json='{"NIM": 4.2, "CAR": 16}',
        peer_compare_json='{"peer_avg_pe": 8.1}',
        fundamental_score=70,
    )
    assert '"NIM"' in fa.key_metrics_json
    assert "peer_avg_pe" in fa.peer_compare_json


def test_fundamental_analysis_empty_json_fallback():
    fa = FundamentalAnalysis(
        ticker="TEST",
        squad="Generic",
        summary="dummy",
        key_metrics_json="",
        peer_compare_json="   ",
        fundamental_score=50,
    )
    assert fa.key_metrics_json == "{}"
    assert fa.peer_compare_json == "{}"
