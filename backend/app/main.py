"""FastAPI uygulama girişi — router register + CORS + APScheduler lifespan."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat as chat_router
from app.api import thesis_rest as thesis_rest_router
from app.api import thesis_ws as ws_router
from app.api import watchlist as watchlist_router
from app.core.config import settings
from app.core.logging import log


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app_startup", env=settings.ENV, cache_backend=settings.CACHE_BACKEND)
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


app.include_router(chat_router.router)
app.include_router(ws_router.router)
app.include_router(thesis_rest_router.router)
app.include_router(watchlist_router.router)
