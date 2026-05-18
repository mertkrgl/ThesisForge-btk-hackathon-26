"""add auth fields to users (password_hash, name, last_login_at)

Revision ID: 003
Revises: 002
Create Date: 2026-05-18

Bağlam: P1 auth iş paketi. Mevcut demo user'ları (UI'da localStorage'daki
UUID + ensure_user_by_id ile insert edilenler) kayıp olmasın → kolonları
nullable ekliyoruz. Yeni register/login akışı password_hash zorunluluğunu
uygulama katmanında garanti eder; demo kayıtlar null password_hash ile kalır
ve giriş yapamaz (verify_password False döner).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("name", sa.String, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "name")
    op.drop_column("users", "password_hash")
