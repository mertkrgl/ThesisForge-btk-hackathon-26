"""@tool decorator + AgentContext — UUID damgalama mekanizması (spec §6.4).

Her tool çağrısı:
  1. Provider'dan veri çeker
  2. tool_call_logs satırı INSERT eder (call_id RETURNING)
  3. {"call_id": "...", "result": {...}} döner

Agent kodu bu call_id'i Observation içinde tutar ve Synthesizer
context'ine taşır.

`current_agent_context` contextvar Strands @tool wrapper'larının kullandığı
implicit bridge'dir; agent runner çağrıdan önce set, sonra reset eder.
"""
from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Awaitable, Callable, Iterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ws_hub import hub as _ws_hub
from app.core.logging import log
from app.db.repo import insert_tool_call_log


@dataclass
class AgentContext:
    """Pipeline boyunca taşınan minimal context.

    Her tool çağrısı thesis_id, agent_id ve DB session'a sahip olmalı.
    `registry` opsiyoneldir; tool fonksiyonları gerekirse buradan
    DataProvider'a erişir.
    """

    thesis_id: uuid.UUID
    agent_id: str
    session: AsyncSession
    registry: dict[str, Any] = field(default_factory=dict)
    last_call_id: str | None = None

    def with_agent(self, agent_id: str) -> "AgentContext":
        """Worker'ları başka agent_id ile çağırmak için klon."""
        return AgentContext(
            thesis_id=self.thesis_id,
            agent_id=agent_id,
            session=self.session,
            registry=self.registry,
            last_call_id=None,
        )


def tool(
    name: str,
) -> Callable[
    [Callable[..., Awaitable[Any]]],
    Callable[..., Awaitable[dict[str, Any]]],
]:
    """Tool decorator. fonksiyon `async def fn(ctx: AgentContext, **kwargs)` olmalı.

    Wrapper davranışı:
      - latency_ms ölç
      - tool_call_logs INSERT
      - {"call_id": <uuid-str>, "result": <result>} döner
      - Exception path: log + raise (DB satırı atılmaz)
    """

    def decorator(fn: Callable[..., Awaitable[Any]]):
        @wraps(fn)
        async def wrapper(ctx: AgentContext, **kwargs) -> dict[str, Any]:
            t0 = time.perf_counter()
            try:
                result = await fn(ctx, **kwargs)
            except Exception as e:
                latency = int((time.perf_counter() - t0) * 1000)
                log.error(
                    "tool_call_fail",
                    tool=name,
                    agent=ctx.agent_id,
                    error=str(e)[:300],
                    latency_ms=latency,
                )
                # Fail-safe log INSERT: result=None → count_tool_calls_for_thesis
                # bu satırı success'e saymaz ama total'a sayar. Audit/debug için
                # hangi tool'un patladığı tool_call_logs'ta görünür kalır. Ayrı
                # bir session aç — caller'ın session'ı rollback edilmiş olabilir.
                try:
                    from app.db.session import session_scope as _scope

                    async with _scope() as _fail_session:
                        await insert_tool_call_log(
                            _fail_session,
                            thesis_id=ctx.thesis_id,
                            agent_id=ctx.agent_id,
                            tool_name=name,
                            args=dict(kwargs),
                            result=None,
                            latency_ms=latency,
                        )
                        await _fail_session.commit()
                except Exception as log_err:
                    log.warning("tool_fail_log_insert_fail", error=str(log_err)[:200])
                # WS'e tool fail bildirimi yay (frontend progress için sayım)
                try:
                    await _ws_hub.publish(
                        ctx.thesis_id,
                        {
                            "type": "tool_progress",
                            "agent": ctx.agent_id,
                            "tool": name,
                            "status": "failed",
                        },
                    )
                except Exception:
                    pass
                raise

            latency_ms = int((time.perf_counter() - t0) * 1000)
            # result mutlaka JSON-serializable bir dict (veya değer) olmalı
            result_for_db: dict[str, Any]
            if isinstance(result, dict):
                result_for_db = result
            else:
                result_for_db = {"value": result}

            call_id = await insert_tool_call_log(
                ctx.session,
                thesis_id=ctx.thesis_id,
                agent_id=ctx.agent_id,
                tool_name=name,
                args=dict(kwargs),
                result=result_for_db,
                latency_ms=latency_ms,
            )
            call_id_str = str(call_id)
            ctx.last_call_id = call_id_str
            log.info(
                "tool_call_ok",
                tool=name,
                agent=ctx.agent_id,
                call_id=call_id_str,
                latency_ms=latency_ms,
            )
            # WS'e tool başarısı bildirimi — frontend per-agent progress için.
            # Sessiz fail OK: WS yoksa pipeline devam etsin.
            try:
                await _ws_hub.publish(
                    ctx.thesis_id,
                    {
                        "type": "tool_progress",
                        "agent": ctx.agent_id,
                        "tool": name,
                        "status": "ok",
                        "call_id": call_id_str,
                    },
                )
            except Exception:
                pass
            return {"call_id": call_id_str, "result": result}

        wrapper.__tool_name__ = name  # type: ignore[attr-defined]
        return wrapper

    return decorator


# ───────────────────────── contextvar bridge ─────────────────────────

current_agent_context: ContextVar[AgentContext | None] = ContextVar(
    "current_agent_context", default=None
)


@contextmanager
def use_agent_context(ctx: AgentContext) -> Iterator[AgentContext]:
    """`with use_agent_context(ctx): agent("...")` — Strands tool wrapper'ları
    bu context boyunca aktif AgentContext'i okuyabilir.
    """
    token = current_agent_context.set(ctx)
    try:
        yield ctx
    finally:
        current_agent_context.reset(token)


def get_current_context() -> AgentContext:
    """Strands tool wrapper'ları içinden çağrılır. Set edilmediyse RuntimeError."""
    ctx = current_agent_context.get()
    if ctx is None:
        raise RuntimeError(
            "use_agent_context(ctx) bloğu dışında tool çağrılamaz"
        )
    return ctx
