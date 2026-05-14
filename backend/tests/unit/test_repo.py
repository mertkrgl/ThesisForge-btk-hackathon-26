"""Aşama 2 smoke — repo CRUD ile DB round-trip."""
from __future__ import annotations

import uuid

import pytest

from app.db.repo import (
    create_thesis_skeleton,
    ensure_user,
    get_thesis,
    get_tool_call_log,
    insert_citation,
    insert_tool_call_log,
    update_thesis_kaynaksiz_flag,
)


pytestmark = pytest.mark.integration


async def test_user_create_idempotent(pg_session):
    u1 = await ensure_user(pg_session, email="a@b.com")
    u2 = await ensure_user(pg_session, email="a@b.com")
    assert u1.id == u2.id


async def test_thesis_skeleton_and_outcome_default(pg_session):
    thesis_id = await create_thesis_skeleton(
        pg_session, ticker="ASELS", user_mode="default", squad="Defense"
    )
    t = await get_thesis(pg_session, thesis_id)
    assert t is not None
    assert t.ticker == "ASELS"
    assert t.outcome == "pending"
    assert t.had_kaynaksiz_flag is False


async def test_tool_call_log_round_trip(pg_session):
    thesis_id = await create_thesis_skeleton(
        pg_session, ticker="THYAO", squad="Generic"
    )
    call_id = await insert_tool_call_log(
        pg_session,
        thesis_id=thesis_id,
        agent_id="technical_worker",
        tool_name="get_ohlcv",
        args={"ticker": "THYAO", "days": 90},
        result={"rows": 61, "last_close": 307.5},
        latency_ms=142,
    )
    assert isinstance(call_id, uuid.UUID)

    row = await get_tool_call_log(pg_session, call_id, thesis_id)
    assert row is not None
    assert row.tool_name == "get_ohlcv"
    assert row.result["last_close"] == 307.5
    assert row.latency_ms == 142


async def test_citation_with_call_id_passes_check_constraint(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="GARAN", squad="Banking")
    call_id = await insert_tool_call_log(
        pg_session,
        thesis_id=thesis_id,
        agent_id="fundamental_worker",
        tool_name="compute_ratios",
        args={"ticker": "GARAN"},
        result={"PE": 5.2, "PB": 1.1},
        latency_ms=80,
    )
    cid = await insert_citation(
        pg_session,
        thesis_id=thesis_id,
        claim_text="GARAN F/K oranı 5.2",
        call_id=call_id,
        is_kaynaksiz=False,
    )
    assert isinstance(cid, uuid.UUID)


async def test_citation_kaynaksiz_must_have_null_call_id(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="TUPRS", squad="Energy")
    cid = await insert_citation(
        pg_session,
        thesis_id=thesis_id,
        claim_text="(kaynaksız iddia)",
        call_id=None,
        is_kaynaksiz=True,
    )
    assert isinstance(cid, uuid.UUID)


async def test_kaynaksiz_flag_update(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="BIMAS", squad="Retail")
    await update_thesis_kaynaksiz_flag(pg_session, thesis_id, True)
    t = await get_thesis(pg_session, thesis_id)
    assert t is not None
    assert t.had_kaynaksiz_flag is True
