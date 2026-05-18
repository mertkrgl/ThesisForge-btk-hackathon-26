"""Auth helpers — bcrypt + JWT.

P1 auth iş paketinden — register/login/me/refresh endpoint'leri ve
get_current_user dependency burada tanımlı yardımcıları kullanır.

Pass hashing: bcrypt (work factor 12 — modern donanımda ~250ms, login UX'i
zorlamadan dictionary attack'ı yavaşlatır).

Token: JWT HS256. İki tür token:
  - access  → kısa ömürlü (settings.ACCESS_TOKEN_EXPIRE_DAYS, default 7g)
  - refresh → uzun ömürlü (settings.REFRESH_TOKEN_EXPIRE_DAYS, default 30g)

Refresh token DB'de tutulmuyor — JWT signature + exp'e güveniyoruz. Logout
client-side localStorage clear ile yapılır (server blacklist hackathon kapsam
dışı). Server compromise olursa JWT_SECRET rotate edilince tüm token'lar
invalid olur.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import settings


TokenType = Literal["access", "refresh"]


def hash_password(plain: str) -> str:
    """bcrypt hash — work factor 12, salt otomatik. Return UTF-8 string."""
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    """Plain password'ü bcrypt hash ile karşılaştır.

    hashed=None ise (demo user'lar) hep False döner — login imkansız.
    """
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(
    *,
    user_id: uuid.UUID,
    email: str,
    token_type: TokenType,
    expires_delta: timedelta,
) -> str:
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    return _create_token(
        user_id=user_id,
        email=email,
        token_type="access",
        expires_delta=timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS),
    )


def create_refresh_token(user_id: uuid.UUID, email: str) -> str:
    return _create_token(
        user_id=user_id,
        email=email,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


class TokenError(Exception):
    """JWT decode/verify hatalarının uygulamaya özel sarmalayıcısı."""


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    """JWT decode + claim doğrulaması. Hata durumunda TokenError raise."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenError("token süresi dolmuş") from e
    except jwt.InvalidTokenError as e:
        raise TokenError("token geçersiz") from e

    if payload.get("type") != expected_type:
        raise TokenError(f"yanlış token türü (beklenen: {expected_type})")
    if "sub" not in payload or "email" not in payload:
        raise TokenError("token claim'leri eksik")
    return payload
