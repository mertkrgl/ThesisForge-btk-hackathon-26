"""In-memory WS event hub — orchestrator publish, WS endpoint subscribe.

Tek instance varsayımı. Redis pub/sub yükseltmesi Aşama 13.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any, AsyncIterator


_DONE_SENTINEL = object()


class WSHub:
    def __init__(self) -> None:
        self._queues: dict[uuid.UUID, asyncio.Queue[Any]] = {}

    def _ensure(self, thesis_id: uuid.UUID) -> asyncio.Queue[Any]:
        q = self._queues.get(thesis_id)
        if q is None:
            q = asyncio.Queue()
            self._queues[thesis_id] = q
        return q

    async def publish(self, thesis_id: uuid.UUID, event: dict[str, Any]) -> None:
        q = self._ensure(thesis_id)
        await q.put(event)
        if event.get("type") in ("done", "error"):
            # subscriber'a kapanış sinyali
            await q.put(_DONE_SENTINEL)

    async def subscribe(
        self, thesis_id: uuid.UUID, *, timeout_sec: float = 180.0
    ) -> AsyncIterator[dict[str, Any]]:
        q = self._ensure(thesis_id)
        try:
            while True:
                try:
                    item = await asyncio.wait_for(q.get(), timeout=timeout_sec)
                except asyncio.TimeoutError:
                    yield {"type": "error", "msg": "subscribe timeout"}
                    return
                if item is _DONE_SENTINEL:
                    return
                yield item
        finally:
            # Tüketici çıktığında kuyruğu serbest bırak.
            self._queues.pop(thesis_id, None)


hub = WSHub()
