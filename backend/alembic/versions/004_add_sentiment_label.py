"""add sentiment_label column to theses

Revision ID: 004
Revises: 003
Create Date: 2026-05-18

Bağlam: P2 madde 20. Bull/bear skor toplamından türetilen kategorik etiket
(POZITIF / NEGATIF / NÖTR) tez detayında yeşil/kırmızı/gri badge olarak
gösterilir. Mevcut tezlere değer yazılmıyor — yeni tezlerden itibaren
doldurulur, eski kayıtlar için frontend null güvenli render eder.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "theses",
        sa.Column("sentiment_label", sa.String, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("theses", "sentiment_label")
