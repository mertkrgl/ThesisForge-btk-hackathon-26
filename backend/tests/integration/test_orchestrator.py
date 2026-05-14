"""Aşama 8 — Orchestrator entegrasyonu (gerçek DB + mocked Strands ajanlar).

`pg_session` fixture'ını kullanmak için orchestrator'ın `session_scope`'unu
test session'una bağlamak gerek. Bunu monkeypatch ile yapıyoruz.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select

from app.agents import orchestrator as orch
from app.agents.schemas import (
    Critique,
    FundamentalAnalysis,
    KeyLevels,
    MacroContextOutput,
    MemoryHit,
    Observation,
    SectorAssignment,
    TechnicalAnalysis,
    ThesisStructured,
)
from app.db.models import Thesis


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


@asynccontextmanager
async def _const_session_scope(session):
    """orchestrator session_scope()'u sabit test session'una bağlamak için."""
    yield session


async def test_orchestrator_happy_path(pg_session, monkeypatch):
    # ─── session_scope() override ───
    @asynccontextmanager
    async def patched_scope():
        # commit caller'da çağrıldığında transaction rollback fixture'ı bozulmasın
        # diye no-op bir wrapper yapacağız.
        yield pg_session

    monkeypatch.setattr(orch, "session_scope", patched_scope)

    # commit'i no-op yap (rollback fixture'ı transaction'ı kontrol ediyor)
    async def _noop_commit():
        await pg_session.flush()

    monkeypatch.setattr(pg_session, "commit", _noop_commit)

    # ─── Ajan mock'ları ───
    obs_uuid = uuid.uuid4()

    async def fake_sector(ctx, ticker):
        return SectorAssignment(ticker=ticker.upper(), squad="Defense", confidence=95.0)

    async def fake_macro(ctx):
        return MacroContextOutput(
            paragraph="USD/TRY 39 seviyesinde.",
            usd_try=39.0,
            observations=[],
        )

    async def fake_memory(ctx, ticker, top_k=3):
        return [
            MemoryHit(
                thesis_id=uuid.uuid4(),
                ticker=ticker.upper(),
                thesis_date="2025-11-01",
                distance=0.1,
                outcome="correct",
                ground_truth_return=12.0,
                summary="Geçmiş ASELS tezi başarılı oldu.",
            )
        ]

    async def fake_tech(ctx, ticker):
        return TechnicalAnalysis(
            ticker=ticker.upper(),
            trend_short="bullish",
            trend_long="bullish",
            key_levels=KeyLevels(support=[140.0], resistance=[170.0]),
            momentum_score=72,
            patterns_detected=["golden_cross_yaklaşıyor"],
            notable_observations=[
                Observation(
                    text="RSI 67",
                    citation_call_id=str(obs_uuid),
                    confidence=80.0,
                )
            ],
        )

    async def fake_fund(ctx, ticker, squad="Generic"):
        return FundamentalAnalysis(
            ticker=ticker.upper(),
            squad=squad,
            summary="Backlog güçlü.",
            key_metrics={"backlog": 8000, "USD_revenue_pct": 60},
            fundamental_score=70,
        )

    async def fake_devil(ctx, ticker, tech, fund, memory_hits=None):
        return Critique(
            technical_pushback=["RSI aşırı alıma yakın"],
            fundamental_pushback=[],
            cross_cutting_risks=["Makro belirsizlik"],
            base_rate_warnings=[],
            overall_critique_strength=40,
        )

    async def fake_synth(ctx, **kw):
        return (
            "## TL;DR\n"
            "ASELS güçlü teknik momentum ve sağlam fundamental tablo gösteriyor.\n\n"
            "## Bull Case\n"
            "- Backlog 8000 milyon USD seviyesinde.\n\n"
            "## Disclaimer\nBilgi amaçlıdır.\n"
        )

    async def fake_extract(ctx, *, ticker, thesis_md):
        return ThesisStructured()

    async def fake_embed(thesis_id, thesis_md):
        # fire-and-forget, no-op
        return None

    monkeypatch.setattr(orch.sec_mod, "run_sector_router", fake_sector)
    monkeypatch.setattr(orch.macro_mod, "run_macro_context", fake_macro)
    monkeypatch.setattr(orch.mem_mod, "search_memory", fake_memory)
    monkeypatch.setattr(orch.tech_mod, "run_technical_worker", fake_tech)
    monkeypatch.setattr(orch.fund_mod, "run_fundamental_worker", fake_fund)
    monkeypatch.setattr(orch.devil_mod, "run_devils_advocate", fake_devil)
    monkeypatch.setattr(orch.synth_mod, "run_synthesizer", fake_synth)
    monkeypatch.setattr(orch.synth_mod, "extract_structured", fake_extract)
    monkeypatch.setattr(orch.mem_mod, "write_thesis_embedding_async", fake_embed)

    # ─── WS emit toplayıcı ───
    events: list[dict] = []

    async def emit(ev):
        events.append(ev)

    # ─── Run pipeline ───
    thesis_id = await orch.run_thesis(
        "ASELS",
        user_id=None,
        user_mode="default",
        websocket_emit=emit,
        timeout_sec=30.0,
    )
    assert isinstance(thesis_id, uuid.UUID)

    # DB persistance
    res = await pg_session.execute(select(Thesis).where(Thesis.id == thesis_id))
    row = res.scalar_one()
    assert row.ticker == "ASELS"
    assert row.squad == "Defense"
    assert row.confidence is not None and row.confidence > 0
    assert row.thesis_md and "TL;DR" in row.thesis_md
    assert row.confidence_breakdown is not None
    assert "weights" in row.confidence_breakdown

    # WS event sequence — temel olaylar geldi mi?
    types = [e.get("type") for e in events]
    assert "agent_start" in types
    assert "stage" in types
    assert "done" in types
    # En az 1 token event (chunked stream)
    assert any(e.get("type") == "token" for e in events)


async def test_orchestrator_conservative_caps_confidence(pg_session, monkeypatch):
    @asynccontextmanager
    async def patched_scope():
        yield pg_session

    monkeypatch.setattr(orch, "session_scope", patched_scope)

    async def _noop_commit():
        await pg_session.flush()

    monkeypatch.setattr(pg_session, "commit", _noop_commit)

    async def hi_sector(ctx, ticker):
        return SectorAssignment(ticker=ticker.upper(), squad="Banking", confidence=95.0)

    async def hi_macro(ctx):
        return MacroContextOutput(paragraph="iyi durum", observations=[])

    async def hi_memory(ctx, ticker, top_k=3):
        return []

    async def hi_tech(ctx, ticker):
        return TechnicalAnalysis(
            ticker=ticker.upper(),
            trend_short="bullish",
            trend_long="bullish",
            key_levels=KeyLevels(),
            momentum_score=95,
        )

    async def hi_fund(ctx, ticker, squad="Generic"):
        return FundamentalAnalysis(
            ticker=ticker.upper(),
            squad=squad,
            summary="çok güçlü",
            fundamental_score=95,
        )

    async def hi_devil(ctx, ticker, tech, fund, memory_hits=None):
        return Critique(
            technical_pushback=[], fundamental_pushback=[],
            cross_cutting_risks=[], base_rate_warnings=[],
            overall_critique_strength=10,
        )

    async def md(ctx, **kw):
        return "## TL;DR\nx.\n\n## Disclaimer\nBilgi amaçlıdır.\n"

    async def ext(ctx, *, ticker, thesis_md):
        return ThesisStructured()

    async def emb(*a, **kw):
        return None

    monkeypatch.setattr(orch.sec_mod, "run_sector_router", hi_sector)
    monkeypatch.setattr(orch.macro_mod, "run_macro_context", hi_macro)
    monkeypatch.setattr(orch.mem_mod, "search_memory", hi_memory)
    monkeypatch.setattr(orch.tech_mod, "run_technical_worker", hi_tech)
    monkeypatch.setattr(orch.fund_mod, "run_fundamental_worker", hi_fund)
    monkeypatch.setattr(orch.devil_mod, "run_devils_advocate", hi_devil)
    monkeypatch.setattr(orch.synth_mod, "run_synthesizer", md)
    monkeypatch.setattr(orch.synth_mod, "extract_structured", ext)
    monkeypatch.setattr(orch.mem_mod, "write_thesis_embedding_async", emb)

    thesis_id = await orch.run_thesis(
        "GARAN", user_mode="conservative", timeout_sec=30.0
    )
    res = await pg_session.execute(select(Thesis).where(Thesis.id == thesis_id))
    row = res.scalar_one()
    assert row.confidence is not None
    assert row.confidence <= 70.0  # cap uygulandı
    assert row.confidence_breakdown.get("applied_cap") == 70.0
