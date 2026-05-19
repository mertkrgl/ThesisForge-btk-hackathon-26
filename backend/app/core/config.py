"""Application settings — Pydantic v2 BaseSettings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
_REPO_ROOT = _BACKEND_DIR.parent                              # btk-hackathon-26/


class Settings(BaseSettings):
    """Backend runtime configuration.

    Reads from `backend/.env` first; falls back to repo-root `.env.probe`
    so the dev-time TCMB/MKK keys stay available without duplication.
    """

    model_config = SettingsConfigDict(
        env_file=(
            str(_REPO_ROOT / ".env.probe"),
            str(_BACKEND_DIR / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── App
    ENV: Literal["dev", "demo", "production"] = "dev"
    LOG_LEVEL: str = "INFO"
    THESISFORGE_MODE: Literal["live", "fixture"] = "live"
    CACHE_BACKEND: Literal["memory", "redis"] = "memory"

    # ── DB
    DATABASE_URL: str = "postgresql+asyncpg://tf:tf@localhost:5433/thesisforge"

    # ── Redis
    REDIS_URL: str = ""

    # ── LLM (Gemini-only stack)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_PRO: str = "gemini-2.5-pro"
    GEMINI_MODEL_FLASH: str = "gemini-2.5-flash"
    # P1-B: Pro path fallback. Primary model (quota/timeout/5xx) fail
    # ederse runtime henüz buna otomatik geçmiyor — config sadece konfigure
    # edilebilir bırakıldı, runtime entegrasyonu sonraki sprint kapsamında.
    # Free tier'da Flash'a düşmek pratik default; billing aktifse Pro koşumu
    # için aynı modeli tekrar yazılabilir veya `gemini-2.5-pro` bırakılır.
    GEMINI_MODEL_PRO_FALLBACK: str = "gemini-2.5-flash"
    GEMINI_EMBED_MODEL: str = "text-embedding-004"
    GEMINI_EMBED_DIMENSIONS: int = 768

    # ── Data sources
    TCMB_EVDS_KEY: str = ""
    MKK_API_KEY: str = ""
    MKK_API_SECRET: str = ""

    # ── Rate limits (req/sec)
    ISYATIRIM_RATE_PER_SEC: float = 1.0
    YFINANCE_RATE_PER_SEC: float = 2.0
    MKK_RATE_PER_SEC: float = 2.0
    TCMB_RATE_PER_SEC: float = 2.0
    BORSAPY_RATE_PER_SEC: float = 2.0

    # ── Demo
    DEMO_KILLSWITCH_THRESHOLD_SEC: int = 90
    DEMO_TOOL_FAIL_THRESHOLD: int = 3

    # ── Auth (P1)
    # JWT secret — prod'da mutlaka env'den okunmalı (32+ byte). Dev'de fallback
    # development-only secret kullanılır; production'da OVERRIDE şart.
    JWT_SECRET: str = "dev-only-thesisforge-secret-CHANGE-IN-PROD-32bytes!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Paths
    PRODUCT_SCRIPTS_PATH: Path = Field(
        default_factory=lambda: _REPO_ROOT / "scripts" / "product"
    )
    FIXTURE_ROOT: Path = Field(
        default_factory=lambda: _BACKEND_DIR / "fixtures"
    )

    @field_validator("PRODUCT_SCRIPTS_PATH", "FIXTURE_ROOT", mode="after")
    @classmethod
    def _resolve_paths(cls, v: Path) -> Path:
        return v.expanduser().resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
