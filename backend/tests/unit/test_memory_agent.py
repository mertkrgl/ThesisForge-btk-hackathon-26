"""Aşama 6 — Gemini embedding (stub fallback) + pgvector similarity_search + memory_agent."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.agents.embedding import embed_text
from app.agents.memory_agent import search_memory, write_thesis_embedding_async
from app.agents.tools import AgentContext
from app.db.models import Thesis
from app.db.repo import create_thesis_skeleton, similarity_search


pytestmark = pytest.mark.integration


# ─── embedding.py ────────────────────────────────────────────────────


async def test_embed_text_falls_back_to_stub_when_no_key(monkeypatch):
    """API key boşken deterministik vector döndür."""
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    # _client lru_cache'ini temizle
    from app.agents import embedding as e

    e._client.cache_clear()

    out1 = await embed_text("ASELS analiz")
    out2 = await embed_text("ASELS analiz")
    assert out1["stub"] is True
    assert out1["vector"] == out2["vector"]
    assert len(out1["vector"]) == 768


async def test_embed_text_different_inputs_different_vectors(monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    from app.agents import embedding as e

    e._client.cache_clear()

    a = await embed_text("ASELS")
    b = await embed_text("GARAN")
    assert a["vector"] != b["vector"]


# ─── pgvector similarity_search (repo) ──────────────────────────────


async def _seed_thesis(
    pg_session,
    *,
    ticker: str,
    squad: str,
    outcome: str,
    embedding: list[float],
    days_ago: int = 30,
    return_pct: float = 12.5,
    thesis_md: str = "Geçmiş tez özeti",
) -> uuid.UUID:
    tid = await create_thesis_skeleton(pg_session, ticker=ticker, squad=squad)
    await pg_session.execute(
        update(Thesis)
        .where(Thesis.id == tid)
        .values(
            embedding=embedding,
            outcome=outcome,
            ground_truth_return=return_pct,
            thesis_md=thesis_md,
            thesis_date=datetime.now(timezone.utc) - timedelta(days=days_ago),
        )
    )
    return tid


async def test_similarity_search_filters_pending(pg_session, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    from app.agents import embedding as e

    e._client.cache_clear()

    base_vec = [0.1] * 768
    pending_vec = [0.1] * 768
    done_vec = [0.11] * 768

    pending_id = await _seed_thesis(
        pg_session,
        ticker="ASELS",
        squad="Defense",
        outcome="pending",
        embedding=pending_vec,
    )
    done_id = await _seed_thesis(
        pg_session,
        ticker="ASELS",
        squad="Defense",
        outcome="correct",
        embedding=done_vec,
    )

    hits = await similarity_search(
        pg_session, embedding=base_vec, ticker="ASELS", squad="Defense", top_k=5
    )
    hit_ids = [h["id"] for h in hits]
    assert done_id in hit_ids
    assert pending_id not in hit_ids


async def test_similarity_search_can_include_pending(pg_session, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    from app.agents import embedding as e

    e._client.cache_clear()

    base_vec = [0.1] * 768
    pending_id = await _seed_thesis(
        pg_session,
        ticker="ASELS",
        squad="Defense",
        outcome="pending",
        embedding=[0.1] * 768,
    )

    hits = await similarity_search(
        pg_session,
        embedding=base_vec,
        ticker="ASELS",
        squad="Defense",
        top_k=5,
        include_pending=True,
    )
    assert pending_id in [h["id"] for h in hits]


async def test_similarity_search_by_squad_when_ticker_different(pg_session):
    base_vec = [0.2] * 768
    # GARAN aynı squad'da (Banking) ama farklı ticker
    await _seed_thesis(
        pg_session,
        ticker="GARAN",
        squad="Banking",
        outcome="correct",
        embedding=[0.21] * 768,
    )
    hits = await similarity_search(
        pg_session,
        embedding=base_vec,
        ticker="AKBNK",
        squad="Banking",
        top_k=3,
    )
    assert len(hits) >= 1
    assert hits[0]["ticker"] == "GARAN"


async def test_memory_agent_search_returns_typed_hits(pg_session, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    from app.agents import embedding as e

    e._client.cache_clear()

    tid = await _seed_thesis(
        pg_session,
        ticker="TUPRS",
        squad="Energy",
        outcome="correct",
        embedding=(await embed_text("TUPRS yatırım tezi"))["vector"],
        return_pct=18.0,
    )
    ctx = AgentContext(thesis_id=uuid.uuid4(), agent_id="x", session=pg_session)
    hits = await search_memory(ctx, "TUPRS", "TUPRS yatırım tezi", top_k=3)
    assert any(h.ticker == "TUPRS" and h.outcome == "correct" for h in hits)
    assert hits[0].ground_truth_return == 18.0
    assert hits[0].thesis_id == tid


async def test_memory_agent_reserves_resolved_hits_when_pending_is_closer(
    pg_session, monkeypatch
):
    from app.core import config

    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    from app.agents import embedding as e

    e._client.cache_clear()

    query_vec = (await embed_text("GARAN banka temettü tezi"))["vector"]
    resolved_id = await _seed_thesis(
        pg_session,
        ticker="GARAN",
        squad="Banking",
        outcome="correct",
        embedding=[x + 0.001 for x in query_vec],
        return_pct=14.8,
        thesis_md="Sonuçlanmış GARAN tezi",
    )
    pending_id = await _seed_thesis(
        pg_session,
        ticker="GARAN",
        squad="Banking",
        outcome="pending",
        embedding=query_vec,
        return_pct=0.0,
        thesis_md="Henüz sonuçlanmamış GARAN tezi",
    )

    ctx = AgentContext(thesis_id=uuid.uuid4(), agent_id="x", session=pg_session)
    hits = await search_memory(ctx, "GARAN", "GARAN banka temettü tezi", top_k=2)

    hit_ids = [h.thesis_id for h in hits]
    assert resolved_id in hit_ids
    assert pending_id in hit_ids
