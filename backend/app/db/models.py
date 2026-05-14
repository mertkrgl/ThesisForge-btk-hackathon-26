"""SQLAlchemy 2.0 ORM models — spec §5.3.

5 tablo:
  - users
  - watchlist
  - theses                (ana iş tablosu, embedding VECTOR(768))
  - tool_call_logs        (UUID damgası kaynağı)
  - citations             (claim → tool_call mapping)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Tüm ORM modellerinin base'i."""


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    tier: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'free'")
    )
    user_mode: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'default'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    __table_args__ = (
        CheckConstraint("tier IN ('free','pro','b2b')", name="ck_users_tier"),
        CheckConstraint(
            "user_mode IN ('default','conservative')",
            name="ck_users_user_mode",
        ),
    )


class Watchlist(Base):
    __tablename__ = "watchlist"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    ticker: Mapped[str] = mapped_column(String, primary_key=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )


class Thesis(Base):
    __tablename__ = "theses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    squad: Mapped[str] = mapped_column(String, nullable=False)
    user_mode: Mapped[str] = mapped_column(String, nullable=False)
    thesis_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    thesis_md: Mapped[str | None] = mapped_column(String, nullable=True)
    bull_points: Mapped[list | dict | None] = mapped_column(JSONB, nullable=True)
    bear_points: Mapped[list | dict | None] = mapped_column(JSONB, nullable=True)
    catalysts: Mapped[list | dict | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    price_at_thesis: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    price_7d: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    price_30d: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    price_90d: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    ground_truth_return: Mapped[float | None] = mapped_column(Float, nullable=True)
    outcome: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'pending'")
    )
    had_kaynaksiz_flag: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('correct','partial','wrong','pending')",
            name="ck_theses_outcome",
        ),
        Index("idx_theses_ticker_date", "ticker", text("thesis_date DESC")),
        Index("idx_theses_user_date", "user_id", text("thesis_date DESC")),
    )


class ToolCallLog(Base):
    __tablename__ = "tool_call_logs"

    call_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    thesis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("theses.id", ondelete="CASCADE"),
        nullable=True,
    )
    agent_id: Mapped[str] = mapped_column(String, nullable=False)
    tool_name: Mapped[str] = mapped_column(String, nullable=False)
    args: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    __table_args__ = (
        Index("idx_tool_call_logs_thesis", "thesis_id"),
        Index("idx_tool_call_logs_agent_tool", "agent_id", "tool_name"),
    )


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    thesis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("theses.id", ondelete="CASCADE"),
        nullable=False,
    )
    claim_text: Mapped[str] = mapped_column(String, nullable=False)
    call_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_call_logs.call_id"),
        nullable=True,
    )
    is_kaynaksiz: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    __table_args__ = (
        CheckConstraint(
            "(is_kaynaksiz = true  AND call_id IS NULL) OR "
            "(is_kaynaksiz = false AND call_id IS NOT NULL)",
            name="chk_kaynaksiz_consistency",
        ),
        Index("idx_citations_thesis", "thesis_id"),
    )
