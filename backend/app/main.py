"""FastAPI uygulama girişi — router register + CORS + APScheduler lifespan."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_router
from app.api import chat as chat_router
from app.api import companies as companies_router
from app.api import config_info as config_info_router
from app.api import market as market_router
from app.api import thesis_rest as thesis_rest_router
from app.api import thesis_ws as ws_router
from app.api import watchlist as watchlist_router
from app.core.config import settings
from app.core.logging import log


async def _warmup() -> None:
    """Pipeline cold start latency'sini düşürmek için module preload + cache hit.

    İlk request'te yfinance modülü ilk import (~5-10s) + Gemini client init
    (~3-5s) + yfinance BIST cache miss (~20-30s) overhead'i ~30-50s'ye varıyor.
    Bu maliyeti uvicorn startup zamanına alıyoruz; demo'da ilk ticker'ın
    ortalama ticker süresine yakın çıkması için.
    """

    async def _yf_warmup() -> None:
        import yfinance as yf
        await asyncio.to_thread(
            lambda: yf.Ticker("GARAN.IS").history(period="5d")
        )

    async def _gemini_warmup() -> None:
        # Gemini client'i sadece init et — gerçek API call yapmıyoruz
        # (token harcamamak için). lru_cache'li factory ilk çağrıda
        # GeminiModel instance'ı yaratır; sonraki agent build_agent
        # çağrılarında bu instance reuse edilir.
        from app.agents.runtime import flash_model, pro_model
        flash_model()
        pro_model()

    async def _db_warmup() -> None:
        from sqlalchemy import text
        from app.db.session import session_scope
        async with session_scope() as s:
            await s.execute(text("SELECT 1"))

    results = await asyncio.gather(
        _yf_warmup(), _gemini_warmup(), _db_warmup(),
        return_exceptions=True,
    )
    failures = [
        (name, r)
        for name, r in zip(("yfinance", "gemini", "db"), results)
        if isinstance(r, Exception)
    ]
    if failures:
        for name, err in failures:
            log.warning("warmup_step_failed", step=name, error=str(err)[:200])
    else:
        log.info("warmup_done")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app_startup", env=settings.ENV, cache_backend=settings.CACHE_BACKEND)
    try:
        await _warmup()
    except Exception as e:
        log.warning("warmup_failed", error=str(e)[:200])
    # Aşama 10 — nightly outcome cron buraya gelecek (şimdilik atlandı).
    yield
    log.info("app_shutdown")


app = FastAPI(
    title="ThesisForge",
    version="0.1.0",
    description="Citation-grounded multi-agent BIST analysis backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.ENV}


app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(ws_router.router)
app.include_router(thesis_rest_router.router)
app.include_router(watchlist_router.router)
app.include_router(market_router.router)
app.include_router(config_info_router.router)
app.include_router(companies_router.router)
