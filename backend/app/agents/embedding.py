"""Gemini text embedding — `text-embedding-004` 768-dim Matryoshka truncate.

google-genai SDK kullanılır. API key yoksa graceful fallback: deterministik
seed-based fake vector (test ortamı için).
"""
from __future__ import annotations

import asyncio
import random
from functools import lru_cache

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.core.logging import log


@lru_cache(maxsize=1)
def _client() -> genai.Client | None:
    if not settings.GEMINI_API_KEY:
        return None
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _deterministic_vector(text: str, dimensions: int) -> list[float]:
    """API yokken testler kırılmasın diye seed-based vector."""
    seed = sum(ord(c) for c in text[:512]) or 1
    rng = random.Random(seed)
    return [round(rng.uniform(-1.0, 1.0), 6) for _ in range(dimensions)]


async def embed_text(
    text: str,
    *,
    dimensions: int | None = None,
    task_type: str = "SEMANTIC_SIMILARITY",
) -> dict:
    """Tek bir metin için embedding döndür.

    Returns:
        {
            "dimensions": int,
            "vector": list[float],
            "model": str,
            "stub": bool,  # True ise API çağrılmadı (key yok)
        }
    """
    dim = dimensions or settings.GEMINI_EMBED_DIMENSIONS
    client = _client()
    if client is None:
        log.warning("embed_text_stub", reason="no_api_key")
        return {
            "dimensions": dim,
            "vector": _deterministic_vector(text, dim),
            "model": "stub",
            "stub": True,
        }

    def _call() -> list[float]:
        resp = client.models.embed_content(
            model=settings.GEMINI_EMBED_MODEL,
            contents=text,
            config=genai_types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=dim,
            ),
        )
        return list(resp.embeddings[0].values)

    try:
        vec = await asyncio.to_thread(_call)
    except Exception as e:
        log.error("embed_text_api_fail", error=str(e)[:200])
        return {
            "dimensions": dim,
            "vector": _deterministic_vector(text, dim),
            "model": "stub_fallback",
            "stub": True,
            "error": str(e)[:200],
        }

    return {
        "dimensions": dim,
        "vector": vec,
        "model": settings.GEMINI_EMBED_MODEL,
        "stub": False,
    }
