"""Strands Agents runtime — Gemini model factory + agent helper'lar.

Model katmanı:
  - `flash_model()`: Gemini Flash (hızlı, ucuz) — 6 ajan default'u
  - `pro_model()`: Gemini Pro (kalite kritik) — Devil's Advocate + Synthesizer

`build_agent(...)` ortak constructor — system_prompt + tools + structured output.
`run_agent_with_context(...)` AgentContext'i contextvar'a yerleştirip Strands
Agent'ı çağırır.
"""
from __future__ import annotations

import asyncio
import random
from functools import lru_cache
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from strands import Agent
from strands.models.gemini import GeminiModel
from strands.tools.executors import ConcurrentToolExecutor

from app.agents.tools import AgentContext, use_agent_context
from app.core.config import settings
from app.core.logging import log


# Gemini transient hata token'ları — exception mesajında geçerse retry.
# 503 UNAVAILABLE: server-side kapasite sıkışması (en yaygın)
# 429 RESOURCE_EXHAUSTED: rate limit (RPM aşımı; dakika sonu reset)
# 500 INTERNAL: nadir transient server hatası
# DEADLINE_EXCEEDED: upstream timeout
_RETRYABLE_TOKENS = (
    "503",
    "UNAVAILABLE",
    "429",
    "RESOURCE_EXHAUSTED",
    "500",
    "INTERNAL",
    "DEADLINE_EXCEEDED",
)
_RETRY_DELAYS = (3.0, 8.0, 15.0)  # 3 deneme arası bekleme


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


# ───────────────────────── Model factory ─────────────────────────


@lru_cache(maxsize=4)
def _gemini_model(model_id: str, max_output_tokens: int) -> GeminiModel:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY env değişkeni boş. backend/.env'e ekle veya "
            ".env.probe'a tanımla."
        )
    return GeminiModel(
        client_args={"api_key": settings.GEMINI_API_KEY},
        model_id=model_id,
        params={"temperature": 0.3, "max_output_tokens": max_output_tokens},
    )


def flash_model() -> GeminiModel:
    # 4096 yetmiyordu — extractor gibi structured-output ajanlar Gemini 2.5
    # thinking mode'da budget'ın çoğunu reasoning'e harcayıp visible output için
    # yer bırakmıyordu. 8192 hem worker'lara hem extractor'a rahat sığar.
    return _gemini_model(settings.GEMINI_MODEL_FLASH, 8192)


def pro_model() -> GeminiModel:
    # Synthesizer + Devil's Advocate uzun, yapılandırılmış rapor üretiyor;
    # Gemini 2.5 thinking mode default açık → thinking tokens output budget'ı
    # yiyor. 16384 = thinking (~10K) + visible (~6K) için yeterli, retry
    # senaryosunda da 180s pipeline timeout'unu aşmaz.
    return _gemini_model(settings.GEMINI_MODEL_PRO, 16384)


# ───────────────────────── Prompt loader ─────────────────────────


@lru_cache(maxsize=64)
def read_prompt(filename: str) -> str:
    p = PROMPTS_DIR / filename
    if not p.exists():
        raise FileNotFoundError(f"Prompt dosyası yok: {p}")
    return p.read_text(encoding="utf-8")


# ───────────────────────── Agent factory ─────────────────────────


T = TypeVar("T", bound=BaseModel)


def build_agent(
    *,
    name: str,
    system_prompt: str,
    tools: list[Any],
    use_pro: bool = False,
    structured_output_model: type[BaseModel] | None = None,
) -> Agent:
    """Strands Agent oluştur. structured_output_model verilirse agent
    `.structured_output(...)` ile Pydantic döndürebilir.
    """
    model = pro_model() if use_pro else flash_model()
    return Agent(
        model=model,
        tools=tools,
        # Gün 4A: tool-level paralelizasyon.
        # DB session çakışması `tools.py` ve `strands_tools.py` içinde her tool
        # çağrısına fresh session vererek çözüldü.
        tool_executor=ConcurrentToolExecutor(),
        system_prompt=system_prompt,
        structured_output_model=structured_output_model,
        name=name,
        description=f"ThesisForge {name}",
    )


# ───────────────────────── Runner ─────────────────────────


async def _invoke_with_retry(agent: Agent, prompt: str) -> Any:
    """Gemini 503/429/500 hatalarını exponential backoff ile retry et.

    `_RETRY_DELAYS` (3s, 8s, 15s) → maks 4 deneme, toplam ~26s ek bekleme.
    Pipeline 180s timeout'unu aşmaz (paralel ajanlar ortak bekler).
    """
    name = getattr(agent, "name", "?")
    last_exc: Exception | None = None
    for attempt in range(len(_RETRY_DELAYS) + 1):
        try:
            return await agent.invoke_async(prompt)
        except Exception as e:
            msg = str(e)
            is_retryable = any(t in msg for t in _RETRYABLE_TOKENS)
            if not is_retryable or attempt == len(_RETRY_DELAYS):
                raise
            delay = _RETRY_DELAYS[attempt] + random.uniform(0, 1.5)
            log.warning(
                "agent_retry",
                agent=name,
                attempt=attempt + 1,
                next_delay=round(delay, 1),
                error=msg[:160],
            )
            last_exc = e
            await asyncio.sleep(delay)
    # mantıken ulaşılmaz — son denemede ya return ya raise olur
    assert last_exc is not None
    raise last_exc


async def run_agent_with_context(
    agent: Agent,
    prompt: str,
    ctx: AgentContext,
    *,
    output_model: type[T] | None = None,
) -> Any:
    """Agent'ı çağır; contextvar boyunca AgentContext aktif.

    `agent.invoke_async(prompt)` — native async event loop. `asyncio.to_thread`
    KULLANMA: thread'de yeni event loop oluşur, AsyncSession'un asyncpg
    connection'u cross-loop "Future attached to a different loop" hatası verir.
    invoke_async ile tool'lar caller'la aynı loop'ta çalışır, NullPool ile
    fresh asyncpg connection açılır ama session'un loop'una bağlı kalır.

    Pydantic çıktısı için Agent constructor'a verilen `structured_output_model`
    sayesinde AgentResult.structured_output field'ından çekiyoruz.

    `output_model` verilirse Pydantic objesi, aksi halde AgentResult döner.
    """
    with use_agent_context(ctx):
        try:
            result = await _invoke_with_retry(agent, prompt)
        except Exception as e:
            log.error(
                "agent_run_fail",
                agent=getattr(agent, "name", "?"),
                error=str(e)[:300],
            )
            raise

        if output_model is None:
            return result

        # Pydantic çıktısını AgentResult'tan çıkar
        so = getattr(result, "structured_output", None)
        if isinstance(so, output_model):
            return so
        if so is not None:
            # SDK dict döndürebilir → validate
            try:
                return output_model.model_validate(so)
            except Exception:
                pass

        # Fallback: result.message içeriğinden parse dene (genelde lazım olmaz)
        log.warning(
            "agent_structured_output_missing",
            agent=getattr(agent, "name", "?"),
            result_type=type(result).__name__,
        )
        raise RuntimeError(
            f"Agent {getattr(agent, 'name', '?')} structured_output döndürmedi; "
            f"Agent constructor'a structured_output_model verildiğinden emin ol."
        )
