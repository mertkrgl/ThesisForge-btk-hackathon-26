"""Aşama 9 — API smoke testleri (TestClient + httpx.AsyncClient).

Pipeline (orchestrator) gerçek Gemini çağırmasın diye `_spawn_pipeline` mock'lanır.

pg_session ile API endpoint'lerinin aynı session'ı kullanması için FastAPI
`dependency_overrides[get_session]` kullanıyoruz; bu sayede test transaction'ı
rollback'lenirken endpoint de aynı verileri görüyor.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport
from sqlalchemy import update

from app.db.models import Thesis
from app.db.repo import (
    create_thesis_skeleton,
    ensure_user,
    insert_citation,
    insert_tool_call_log,
)
from app.db.session import get_session


pytestmark = [pytest.mark.integration]


@pytest.fixture
def client():
    """Function-scoped TestClient — her test fresh app + lifespan."""
    from app.main import app

    with TestClient(app) as c:
        yield c


def _override_get_session(session):
    async def _gen():
        yield session

    return _gen


# ─── /chat ────────────────────────────────────────────────────────────


def test_chat_returns_thesis_id_and_ws_url(client, monkeypatch):
    from app.api import chat as chat_mod

    async def fake_spawn(thesis_id, ticker, user_id, mode):
        return None

    monkeypatch.setattr(chat_mod, "_spawn_pipeline", fake_spawn)

    resp = client.post(
        "/chat", json={"message": "ASELS analiz et", "mode": "default"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "thesis_id" in body
    assert body["ticker"] == "ASELS"
    assert body["ws_url"].startswith("/ws/thesis/")


def test_chat_400_when_no_ticker(client, monkeypatch):
    from app.api import chat as chat_mod

    async def fake_spawn(*a, **kw):
        return None

    monkeypatch.setattr(chat_mod, "_spawn_pipeline", fake_spawn)

    # Tüm kelimeler küçük harfli, sector_map'te de geçmiyor → 400
    resp = client.post("/chat", json={"message": "merhaba dünya", "mode": "default"})
    assert resp.status_code == 400


# ─── /api/thesis/{id} ─────────────────────────────────────────────────


async def test_thesis_endpoints_with_seed(pg_session):
    """Thesis seed et, REST endpoint'lerden çıkışı doğrula."""
    from app.main import app

    tid = await create_thesis_skeleton(pg_session, ticker="ASELS", squad="Defense")
    await pg_session.execute(
        update(Thesis)
        .where(Thesis.id == tid)
        .values(
            thesis_md="## TL;DR\nASELS güçlü.",
            confidence=72.5,
            confidence_breakdown={"weights": {}},
            bull_points=[{"point": "backlog", "score": 8}],
            bear_points=[],
            catalysts=[],
            thesis_date=datetime.now(timezone.utc),
        )
    )
    call_id = await insert_tool_call_log(
        pg_session,
        thesis_id=tid,
        agent_id="technical_worker",
        tool_name="get_ohlcv",
        args={"ticker": "ASELS"},
        result={"last_close": 145.0},
        latency_ms=120,
    )
    await insert_citation(
        pg_session,
        thesis_id=tid,
        claim_text="ASELS son kapanış 145.",
        call_id=call_id,
        is_kaynaksiz=False,
    )
    await pg_session.flush()

    app.dependency_overrides[get_session] = _override_get_session(pg_session)
    try:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as ac:
            r1 = await ac.get(f"/api/thesis/{tid}")
            assert r1.status_code == 200
            body = r1.json()
            assert body["ticker"] == "ASELS"
            assert body["confidence"] == 72.5
            assert body["bull_points"]

            r2 = await ac.get(f"/api/thesis/{tid}/citations")
            assert r2.status_code == 200
            cits = r2.json()
            assert len(cits) == 1
            assert cits[0]["call_id"] == str(call_id)
            assert cits[0]["tool_result"]["last_close"] == 145.0
    finally:
        app.dependency_overrides.clear()


async def test_thesis_404():
    """Async httpx.AsyncClient — pg_session ile aynı loop, cross-loop sorunu yok."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        fake = uuid.uuid4()
        r = await ac.get(f"/api/thesis/{fake}")
        assert r.status_code == 404


# ─── /api/watchlist ──────────────────────────────────────────────────


async def test_watchlist_crud(pg_session):
    from app.main import app

    user = await ensure_user(pg_session, email="watchtest@example.com")
    await pg_session.flush()

    app.dependency_overrides[get_session] = _override_get_session(pg_session)
    try:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as ac:
            r = await ac.get("/api/watchlist", params={"user_id": str(user.id)})
            assert r.status_code == 200
            assert r.json() == []

            r = await ac.post(
                "/api/watchlist", json={"user_id": str(user.id), "ticker": "ASELS"}
            )
            assert r.status_code == 201
            assert r.json()["status"] == "added"

            r = await ac.post(
                "/api/watchlist", json={"user_id": str(user.id), "ticker": "ASELS"}
            )
            assert r.status_code == 201
            assert r.json()["status"] == "exists"

            r = await ac.get("/api/watchlist", params={"user_id": str(user.id)})
            assert r.status_code == 200
            items = r.json()
            assert any(it["ticker"] == "ASELS" for it in items)

            r = await ac.delete(
                "/api/watchlist/ASELS", params={"user_id": str(user.id)}
            )
            assert r.status_code == 200

            r = await ac.delete(
                "/api/watchlist/XYZA", params={"user_id": str(user.id)}
            )
            assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


# ─── WS force_demo=1 ─────────────────────────────────────────────────


def test_ws_force_demo_streams_fixture(client, tmp_path, monkeypatch):
    """force_demo=1 ile fixtures/thesis altından stream gelir."""
    from app.core import config

    fix_root = tmp_path / "fixtures"
    (fix_root / "thesis").mkdir(parents=True)
    (fix_root / "thesis" / "ASELS.json").write_text(
        '{"thesis_md": "## TL;DR\\nDemo tezi."}', encoding="utf-8"
    )
    monkeypatch.setattr(config.settings, "FIXTURE_ROOT", fix_root)

    fake_id = uuid.uuid4()
    with client.websocket_connect(f"/ws/thesis/{fake_id}?force_demo=1") as ws:
        events: list[dict] = []
        for _ in range(50):
            try:
                ev = ws.receive_json()
            except Exception:
                break
            events.append(ev)
            if ev.get("type") == "done":
                break
        types = [e.get("type") for e in events]
        assert "done" in types
        assert any(e.get("type") == "token" for e in events)
