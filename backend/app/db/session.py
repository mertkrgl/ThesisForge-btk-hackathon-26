"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool: her bağlantı için yeni asyncpg connection açılır, kullanım sonrası
# hemen kapatılır. Paralel asyncio.gather ile çalışan branch'lerde pool'lu
# connection cross-loop "Future attached to a different loop" hatasına yol
# açıyordu. NullPool bu sorunu kökten çözer; performans cezası küçük (her
# tool log INSERT'i bir bağlantı açar). Hackathon scope'unda kabul edilebilir.
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=False,
    future=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI Depends entry. Her request için yeni session."""
    async with async_session_factory() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Cron/script kullanımı için context manager.

    Pipeline kodu bu helper ile session açar; commit/rollback caller'da.
    """
    async with async_session_factory() as session:
        yield session
