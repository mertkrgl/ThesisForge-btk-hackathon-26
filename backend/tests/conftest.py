"""Pytest fixtures — async DB session with per-test transaction rollback."""
from __future__ import annotations

from typing import AsyncIterator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.session import engine


@pytest_asyncio.fixture(loop_scope="session")
async def pg_session() -> AsyncIterator[AsyncSession]:
    """Her test bir transaction içinde — sonunda rollback.

    Postgres + asyncpg üzerinde testler birbirini kirletmez.
    Migration'ın çalıştırılmış olduğu varsayılır (alembic upgrade head).
    """
    async with engine.connect() as conn:
        trans = await conn.begin()
        Session = async_sessionmaker(
            bind=conn, expire_on_commit=False, autoflush=False
        )
        session = Session()
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()
