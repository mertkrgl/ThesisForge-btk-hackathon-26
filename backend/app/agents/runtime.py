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
from functools import lru_cache
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from strands import Agent
from strands.models.gemini import GeminiModel

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

    `output_model` verilirse structured output döner; aksi halde text yanıt.
    """
    with use_agent_context(ctx):
        try:
            if output_model is not None:
                result = await asyncio.to_thread(
                    lambda: agent.structured_output(output_model, prompt)
                )
                return result
            result = await asyncio.to_thread(lambda: agent(prompt))
            return result
        except Exception as e:
            log.error(
                "agent_run_fail",
                agent=getattr(agent, "name", "?"),
                error=str(e)[:300],
            )
            raise
