"""WS /ws/thesis/{thesis_id} — event stream (tool_start/tool_end/token/done/error).

`?force_demo=1` killswitch → fixtures/thesis/<TICKER>.json'ı 8s yapay delay ile
fake-stream eder. UI'de "demo modu" badge için.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.ws_hub import hub
from app.core.config import settings
from app.core.logging import log
from app.db.repo import get_thesis
from app.db.session import session_scope


router = APIRouter(tags=["ws"])


async def _fake_demo_stream(ws: WebSocket, thesis_id: uuid.UUID) -> None:
    """fixtures/thesis/<TICKER>.json içeriğini 8s yapay delay ile stream eder."""
    # thesis_id'den ticker'ı bul; bulunmazsa fixture'lardan biriyle demo yap.
    ticker = "ASELS"
    try:
        async with session_scope() as s:
            row = await get_thesis(s, thesis_id)
            if row is not None:
                ticker = row.ticker
    except Exception:
        pass

    fixture_path: Path = settings.FIXTURE_ROOT / "thesis" / f"{ticker.upper()}.json"
    if not fixture_path.exists():
        # En azından minimal demo cevabı stream et
        await ws.send_text(json.dumps({"type": "info", "msg": "demo fixture yok, sentetik mesaj"}))
        await asyncio.sleep(1.0)
        await ws.send_text(json.dumps({"type": "token", "content": "## TL;DR\nDemo modu — gerçek pipeline çalışmıyor.\n"}))
        await ws.send_text(json.dumps({"type": "done", "thesis_id": str(thesis_id)}))
        return

    try:
        data = json.loads(fixture_path.read_text(encoding="utf-8"))
    except Exception as e:
        await ws.send_text(json.dumps({"type": "error", "msg": f"fixture parse fail: {e}"}))
        return

    await ws.send_text(json.dumps({"type": "info", "msg": "demo modu", "ticker": ticker}))
    md = data.get("thesis_md") or "## Demo\nÖnceden üretilmiş tez.\n"
    # 8 saniyeye yay
    chunks = [md[i : i + max(1, len(md) // 40)] for i in range(0, len(md), max(1, len(md) // 40))]
    delay = 8.0 / max(1, len(chunks))
    for ch in chunks:
        await ws.send_text(json.dumps({"type": "token", "content": ch}))
        await asyncio.sleep(delay)
    await ws.send_text(json.dumps({"type": "done", "thesis_id": str(thesis_id)}))


@router.websocket("/ws/thesis/{thesis_id}")
async def thesis_ws(
    ws: WebSocket,
    thesis_id: uuid.UUID,
    force_demo: int = Query(default=0),
) -> None:
    await ws.accept()

    if force_demo:
        try:
            await _fake_demo_stream(ws, thesis_id)
        except WebSocketDisconnect:
            return
        except Exception as e:
            log.warning("ws_demo_fail", error=str(e)[:200])
        finally:
            try:
                await ws.close()
            except Exception:
                pass
        return

    try:
        async for event in hub.subscribe(thesis_id, timeout_sec=180.0):
            await ws.send_text(json.dumps(event, default=str))
    except WebSocketDisconnect:
        return
    except Exception as e:
        log.warning("ws_subscribe_fail", error=str(e)[:200])
        try:
            await ws.send_text(json.dumps({"type": "error", "msg": str(e)[:200]}))
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
