"""initial schema — 5 tablo + pgvector + indeksler

Revision ID: 001
Revises:
Create Date: 2026-05-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ─── users
    op.create_table(
        "users",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.String, nullable=False, unique=True),
        sa.Column("tier", sa.String, nullable=False, server_default=sa.text("'free'")),
        sa.Column(
            "user_mode",
            sa.String,
            nullable=False,
            server_default=sa.text("'default'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("tier IN ('free','pro','b2b')", name="ck_users_tier"),
        sa.CheckConstraint(
            "user_mode IN ('default','conservative')",
            name="ck_users_user_mode",
        ),
    )

    # ─── watchlist
    op.create_table(
        "watchlist",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("ticker", sa.String, primary_key=True),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ─── theses
    op.create_table(
        "theses",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("ticker", sa.String, nullable=False),
        sa.Column("squad", sa.String, nullable=False),
        sa.Column("user_mode", sa.String, nullable=False),
        sa.Column(
            "thesis_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("thesis_md", sa.String, nullable=True),
        sa.Column("bull_points", JSONB, nullable=True),
        sa.Column("bear_points", JSONB, nullable=True),
        sa.Column("catalysts", JSONB, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("confidence_breakdown", JSONB, nullable=True),
        sa.Column("memory_hits", JSONB, nullable=True),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.Column("price_at_thesis", sa.Numeric, nullable=True),
        sa.Column("price_7d", sa.Numeric, nullable=True),
        sa.Column("price_30d", sa.Numeric, nullable=True),
        sa.Column("price_90d", sa.Numeric, nullable=True),
        sa.Column("ground_truth_return", sa.Float, nullable=True),
        sa.Column(
            "outcome",
            sa.String,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "had_kaynaksiz_flag",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.CheckConstraint(
            "outcome IN ('correct','partial','wrong','pending')",
            name="ck_theses_outcome",
        ),
    )
    op.execute(
        "CREATE INDEX idx_theses_ticker_date ON theses (ticker, thesis_date DESC)"
    )
    op.execute(
        "CREATE INDEX idx_theses_user_date ON theses (user_id, thesis_date DESC)"
    )
    op.execute(
        "CREATE INDEX idx_theses_embedding ON theses "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute(
        "CREATE INDEX idx_theses_outcome_pending ON theses (thesis_date) "
        "WHERE outcome = 'pending'"
    )

    # ─── tool_call_logs
    op.create_table(
        "tool_call_logs",
        sa.Column(
            "call_id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "thesis_id",
            UUID(as_uuid=True),
            sa.ForeignKey("theses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("agent_id", sa.String, nullable=False),
        sa.Column("tool_name", sa.String, nullable=False),
        sa.Column("args", JSONB, nullable=True),
        sa.Column("result", JSONB, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_tool_call_logs_thesis", "tool_call_logs", ["thesis_id"]
    )
    op.create_index(
        "idx_tool_call_logs_agent_tool",
        "tool_call_logs",
        ["agent_id", "tool_name"],
    )

    # ─── citations
    op.create_table(
        "citations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "thesis_id",
            UUID(as_uuid=True),
            sa.ForeignKey("theses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("claim_text", sa.String, nullable=False),
        sa.Column(
            "call_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tool_call_logs.call_id"),
            nullable=True,
        ),
        sa.Column(
            "is_kaynaksiz",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.CheckConstraint(
            "(is_kaynaksiz = true  AND call_id IS NULL) OR "
            "(is_kaynaksiz = false AND call_id IS NOT NULL)",
            name="chk_kaynaksiz_consistency",
        ),
    )
    op.create_index("idx_citations_thesis", "citations", ["thesis_id"])
    op.execute(
        "CREATE INDEX idx_citations_call ON citations (call_id) "
        "WHERE call_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("idx_citations_call", table_name="citations")
    op.drop_index("idx_citations_thesis", table_name="citations")
    op.drop_table("citations")

    op.drop_index("idx_tool_call_logs_agent_tool", table_name="tool_call_logs")
    op.drop_index("idx_tool_call_logs_thesis", table_name="tool_call_logs")
    op.drop_table("tool_call_logs")

    op.execute("DROP INDEX IF EXISTS idx_theses_outcome_pending")
    op.execute("DROP INDEX IF EXISTS idx_theses_embedding")
    op.execute("DROP INDEX IF EXISTS idx_theses_user_date")
    op.execute("DROP INDEX IF EXISTS idx_theses_ticker_date")
    op.drop_table("theses")

    op.drop_table("watchlist")
    op.drop_table("users")
