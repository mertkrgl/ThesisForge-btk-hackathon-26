"""Strands Agents runtime — Gemini model factory + agent helper'lar.

Model katmanı:
  - `flash_model()`: Gemini Flash (hızlı, ucuz) — 6 ajan default'u
  - `pro_model()`: Gemini Pro (kalite kritik) — Devil's Advocate + Synthesizer

`build_agent(...)` ortak constructor — system_prompt + tools + structured output.
`run_agent_with_context(...)` AgentContext'i contextvar'a yerleştirip Strands
Agent'ı çağırır.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from strands import Agent
from strands.models.gemini import GeminiModel
from strands.tools.executors import SequentialToolExecutor

from app.agents.tools import AgentContext, use_agent_context
from app.core.config import settings
from app.core.logging import log


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


# ───────────────────────── Model factory ─────────────────────────


@lru_cache(maxsize=2)
def _gemini_model(model_id: str) -> GeminiModel:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY env değişkeni boş. backend/.env'e ekle veya "
            ".env.probe'a tanımla."
        )
    return GeminiModel(
        client_args={"api_key": settings.GEMINI_API_KEY},
        model_id=model_id,
        params={"temperature": 0.3, "max_output_tokens": 4096},
    )


def flash_model() -> GeminiModel:
    return _gemini_model(settings.GEMINI_MODEL_FLASH)


def pro_model() -> GeminiModel:
    return _gemini_model(settings.GEMINI_MODEL_PRO)


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
        # SequentialToolExecutor — paralel tool çağrılarında aynı SQLAlchemy
        # AsyncSession'ı yarıştırmasın (insert_tool_call_log INSERT'leri çakışıyor).
        tool_executor=SequentialToolExecutor(),
        system_prompt=system_prompt,
        structured_output_model=structured_output_model,
        name=name,
        description=f"ThesisForge {name}",
    )


# ───────────────────────── Runner ─────────────────────────


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
            result = await agent.invoke_async(prompt)
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
