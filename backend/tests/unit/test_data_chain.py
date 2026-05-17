"""Aşama 3 — ChainedDataProvider, InMemoryCache, fixture round-trip."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.data.cache import InMemoryCache
from app.data.fixture import read_fixture, write_fixture
from app.data.providers.base import DataProvider, ProviderResult
from app.data.registry import ChainedDataProvider


class _AlwaysFails(DataProvider):
    name = "always_fails"

    async def fetch(self, **_) -> ProviderResult:
        raise RuntimeError("intentional")


class _ReturnsConstant(DataProvider):
    def __init__(self, name: str, value: int):
        self.name = name
        self.value = value

    async def fetch(self, **kwargs) -> ProviderResult:
        return ProviderResult(
            source=self.name,
            payload={"value": self.value, "kwargs": kwargs},
        )


# ─── InMemoryCache ────────────────────────────────────────────────────


async def test_inmemory_cache_set_get_delete():
    c = InMemoryCache()
    await c.set("k1", {"x": 1}, ttl=60)
    assert await c.get("k1") == {"x": 1}
    assert await c.get("missing") is None
    await c.delete("k1")
    assert await c.get("k1") is None


# ─── Fixture I/O ──────────────────────────────────────────────────────


async def test_fixture_roundtrip(tmp_path: Path, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "FIXTURE_ROOT", tmp_path)
    result = ProviderResult(source="test", payload={"hello": "world", "n": 42})
    p = await write_fixture("foo:BAR:baz", result, ttl_hours=24)
    assert p.exists()
    # disk JSON şemasına bak
    raw = json.loads(p.read_text())
    assert raw["payload"]["hello"] == "world"
    # read_fixture
    back = await read_fixture("foo:BAR:baz")
    assert back is not None
    assert back.source == "test"
    assert back.payload["n"] == 42


async def test_fixture_missing_returns_none(tmp_path, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "FIXTURE_ROOT", tmp_path)
    assert await read_fixture("nope:there") is None


# ─── ChainedDataProvider ──────────────────────────────────────────────


async def test_chain_primary_hits_first():
    chain = ChainedDataProvider(
        [_ReturnsConstant("primary", 1), _ReturnsConstant("secondary", 2)],
        fixture_key_fn=lambda **_: "test:k",
        domain="test",
    )
    res = await chain.fetch()
    assert res.source == "primary"
    assert res.payload["value"] == 1


async def test_chain_falls_back_to_secondary():
    chain = ChainedDataProvider(
        [_AlwaysFails(), _ReturnsConstant("secondary", 9)],
        fixture_key_fn=lambda **_: "test:k",
        domain="test",
    )
    res = await chain.fetch()
    assert res.source == "secondary"
    assert res.payload["value"] == 9


async def test_chain_falls_back_to_fixture(tmp_path, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "FIXTURE_ROOT", tmp_path)
    # Pre-seed fixture
    await write_fixture(
        "test:k", ProviderResult(source="fx", payload={"v": "from_fixture"})
    )
    chain = ChainedDataProvider(
        [_AlwaysFails(), _AlwaysFails()],
        fixture_key_fn=lambda **_: "test:k",
        domain="test",
    )
    res = await chain.fetch()
    assert res.source == "fx"
    assert res.payload["v"] == "from_fixture"


async def test_chain_raises_when_all_fail(tmp_path, monkeypatch):
    from app.core import config
    from app.data.providers.base import DataUnavailable

    monkeypatch.setattr(config.settings, "FIXTURE_ROOT", tmp_path)
    chain = ChainedDataProvider(
        [_AlwaysFails()],
        fixture_key_fn=lambda **_: "nonexistent:key",
        domain="test",
    )
    with pytest.raises(DataUnavailable):
        await chain.fetch()


async def test_chain_uses_cache_on_second_call():
    cache = InMemoryCache()
    p = _ReturnsConstant("primary", 7)
    chain = ChainedDataProvider(
        [p],
        fixture_key_fn=lambda **_: "test:cache",
        cache=cache,
        cache_ttl=60,
        domain="test",
    )
    r1 = await chain.fetch()
    # ikinci çağrıda provider patlasa bile cache'den dönmeli
    chain.providers = [_AlwaysFails()]
    r2 = await chain.fetch()
    assert r1.payload == r2.payload
    assert r2.source == "primary"
