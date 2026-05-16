"""Aşama 4 — @tool decorator UUID damgalama davranışı + sector_map + tool_registry."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.agents.schemas import AGENT_IDS
from app.agents.sector_map import (
    metrics_for_squad,
    prompt_file_for_squad,
    squad_for_ticker,
)
from app.agents.tool_registry import (
    TOOLS,
    base_rate_check,
    embed_text,
    get_sector_peers,
    lookup_sector,
    select_squad,
)
from app.agents.tools import AgentContext, tool
from app.data.providers.base import DataProvider, ProviderResult
from app.db.models import ToolCallLog
from app.db.repo import create_thesis_skeleton


# ─── Fixtures ─────────────────────────────────────────────────────────


class _FakePriceProvider(DataProvider):
    name = "fake_price"

    async def fetch(self, **kwargs) -> ProviderResult:
        return ProviderResult(
            source=self.name,
            payload={"ticker": kwargs.get("ticker"), "last_close": 100.0, "rows": 1},
        )


class _AlwaysRaises(DataProvider):
    name = "always_raises"

    async def fetch(self, **_) -> ProviderResult:
        raise RuntimeError("boom")


def _make_registry():
    from app.data.registry import ChainedDataProvider

    return {
        "price": ChainedDataProvider(
            [_FakePriceProvider()],
            fixture_key_fn=lambda ticker, days=90, **_: f"price:{ticker}:{days}d",
            domain="price",
        ),
        "fail": ChainedDataProvider(
            [_AlwaysRaises()],
            fixture_key_fn=lambda **_: "fail:none",
            domain="fail",
        ),
    }


# ─── Tests ────────────────────────────────────────────────────────────


async def test_agent_id_dict_has_8_entries():
    assert len(AGENT_IDS) == 8


async def test_squad_for_ticker_known_and_unknown():
    assert squad_for_ticker("ASELS") == "Defense"
    assert squad_for_ticker("GARAN") == "Banking"
    assert squad_for_ticker("XYZ123") == "Generic"


async def test_metrics_and_prompt_lookup():
    assert "NIM" in metrics_for_squad("Banking")
    assert prompt_file_for_squad("Energy").endswith(".md")


async def test_tools_dict_has_all_25_entries():
    # 25 sabit tool ismi (spec §7.2 + memory stubs)
    assert len(TOOLS) == 25
    assert "get_ohlcv" in TOOLS
    assert "embed_text" in TOOLS


async def test_tool_decorator_writes_to_db(pg_session):
    thesis_id = await create_thesis_skeleton(
        pg_session, ticker="THYAO", squad="Generic"
    )
    ctx = AgentContext(
        thesis_id=thesis_id,
        agent_id="technical_worker",
        session=pg_session,
        registry=_make_registry(),
    )

    # Custom @tool ile call_id RETURNING test edelim
    @tool("test_tool")
    async def my_tool(ctx: AgentContext, *, n: int) -> dict:
        return {"n_squared": n * n}

    out = await my_tool(ctx, n=4)
    assert "call_id" in out
    assert out["result"] == {"n_squared": 16}
    cid = uuid.UUID(out["call_id"])

    # DB'de satır var mı?
    res = await pg_session.execute(
        select(ToolCallLog).where(ToolCallLog.call_id == cid)
    )
    row = res.scalar_one()
    assert row.agent_id == "technical_worker"
    assert row.tool_name == "test_tool"
    assert row.result == {"n_squared": 16}
    assert row.args == {"n": 4}
    assert row.latency_ms is not None and row.latency_ms >= 0


async def test_tool_exception_skips_db_write(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="X", squad="Generic")
    ctx = AgentContext(
        thesis_id=thesis_id,
        agent_id="technical_worker",
        session=pg_session,
    )

    @tool("test_fail")
    async def boom(ctx: AgentContext) -> dict:
        raise ValueError("nope")

    before = (await pg_session.execute(select(ToolCallLog))).all()
    with pytest.raises(ValueError):
        await boom(ctx)
    after = (await pg_session.execute(select(ToolCallLog))).all()
    assert len(after) == len(before)


async def test_real_tool_get_sector_peers(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="ASELS", squad="Defense")
    ctx = AgentContext(
        thesis_id=thesis_id, agent_id="fundamental_worker", session=pg_session
    )
    out = await get_sector_peers(ctx, ticker="ASELS")
    assert out["result"]["squad"] == "Defense"
    assert "OTKAR" in out["result"]["peers"]
    assert uuid.UUID(out["call_id"])


async def test_real_tool_lookup_sector_then_select_squad(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="GARAN", squad="Banking")
    ctx = AgentContext(
        thesis_id=thesis_id, agent_id="sector_router", session=pg_session
    )
    out1 = await lookup_sector(ctx, ticker="GARAN")
    assert out1["result"]["squad"] == "Banking"
    out2 = await select_squad(ctx, ticker="GARAN")
    assert out2["result"]["squad"] == "Banking"
    # 2 ayrı tool çağrısı = 2 ayrı UUID
    assert out1["call_id"] != out2["call_id"]


async def test_embed_text_stub_deterministic(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="X", squad="Generic")
    ctx = AgentContext(thesis_id=thesis_id, agent_id="memory_agent", session=pg_session)
    out1 = await embed_text(ctx, text="hello")
    out2 = await embed_text(ctx, text="hello")
    assert out1["result"]["vector"] == out2["result"]["vector"]
    assert len(out1["result"]["vector"]) == 768


async def test_base_rate_check_with_empty_history(pg_session):
    """Hiç tezi olmayan bir squad sorgulandığında fonksiyon boş özet döndürmeli.

    NOT: Banking/Defense gibi seed edilmiş squad'larda DB satır var; bu yüzden
    test deterministik olmak için DB'de bulunmayan bir squad ismi kullanıyor.
    """
    thesis_id = await create_thesis_skeleton(pg_session, ticker="X", squad="Generic")
    ctx = AgentContext(thesis_id=thesis_id, agent_id="devils_advocate", session=pg_session)
    out = await base_rate_check(ctx, squad="NonexistentSquad_XYZ")
    assert out["result"]["squad"] == "NonexistentSquad_XYZ"
    assert out["result"]["total_completed"] == 0
    assert out["result"]["success_rate_pct"] is None
