"""add citation_audit JSONB column to theses

Revision ID: 005
Revises: 004
Create Date: 2026-05-19

Bağlam: BACKEND_AGENT_KALITE_DOGRULAMA.md §P0-B. `had_kaynaksiz_flag` tek
boolean kalite sinyali olarak yeterli değil. Her tez için citation validator
artık 7 sayaç üretiyor (claim_count, cited_claim_count, uncited_claim_count,
numeric_issue_count, catalyst_count, catalyst_cited_count, citation_retry_count).
Bu kolon orchestrator tarafından `update_thesis_synthesis` üzerinden JSONB
olarak persist edilir; UI ileride "Kaynak Sağlığı" göstergesi için sorgular.
Mevcut satırlara backfill yapılmaz — NULL "audit yapılmamış" anlamına gelir.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "theses",
        sa.Column(
            "citation_audit",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("theses", "citation_audit")
