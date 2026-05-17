"""GET /api/config/info — frontend Settings sayfasında modelleri/veri kaynaklarını
read-only göstermek için. Hangi modellerin server-side yapılandırıldığını,
hangi veri sağlayıcıların aktif olduğunu (env key dolu mu) raporlar."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/info")
async def get_config_info() -> dict[str, Any]:
    return {
        "env": settings.ENV,
        "mode": settings.THESISFORGE_MODE,
        "cache_backend": settings.CACHE_BACKEND,
        "models": {
            "pro": settings.GEMINI_MODEL_PRO,
            "flash": settings.GEMINI_MODEL_FLASH,
            "embed": settings.GEMINI_EMBED_MODEL,
            "embed_dimensions": settings.GEMINI_EMBED_DIMENSIONS,
        },
        "data_sources": {
            "yfinance": True,
            "isyatirim": True,
            "tcmb_evds": bool(settings.TCMB_EVDS_KEY),
            "mkk": bool(settings.MKK_API_KEY and settings.MKK_API_SECRET),
            "kap": True,
            "bist": True,
        },
    }
