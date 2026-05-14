"""FastAPI uygulama girişi — Aşama 1: sadece /health.

Sonraki aşamalarda router'lar (api/chat, api/thesis_ws, ...) ve
APScheduler lifespan'inde register edilecek.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import log


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app_startup", env=settings.ENV, cache_backend=settings.CACHE_BACKEND)
    # Aşama 10'da: scheduler = start_scheduler()  /  shutdown'da sched.shutdown()
    yield
    log.info("app_shutdown")


app = FastAPI(
    title="ThesisForge",
    version="0.1.0",
    description="Citation-grounded multi-agent BIST analysis backend",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.ENV}
