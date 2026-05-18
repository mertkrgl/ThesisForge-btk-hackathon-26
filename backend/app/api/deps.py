"""FastAPI dependency'ler — auth (P1).

İki tür dependency:
  - get_current_user            → 401 raise eder Authorization yoksa/geçersizse
  - get_current_user_optional   → None döner, read-only endpoint'ler için

Tüm write action endpoint'leri (POST /chat, POST/DELETE /api/watchlist,
ileride profil güncelleme vb.) get_current_user kullanmalı. Read-only
endpoint'ler (GET /theses, GET /thesis/{id}) get_current_user_optional ile
demo deneyimini korur — yatırımcı login olmadan da geçmiş tezleri görebilir.
"""
from __future__ import annotations

import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, decode_token
from app.db.models import User
from app.db.repo import get_user_by_id
from app.db.session import get_session


_AUTH_HEADER_DESC = "Bearer <access_token>"


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


async def get_current_user(
    authorization: str | None = Header(
        default=None, description=_AUTH_HEADER_DESC
    ),
    session: AsyncSession = Depends(get_session),
) -> User:
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bu işlem için giriş yapmanız gerekiyor.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token sub claim geçersiz",
        )
    user = await get_user_by_id(session, user_id)
    if user is None:
        # User silinmiş ama token hâlâ geçerli — temiz hata mesajı
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hesap bulunamadı, lütfen tekrar giriş yapın.",
        )
    return user


async def get_current_user_optional(
    authorization: str | None = Header(
        default=None, description=_AUTH_HEADER_DESC
    ),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Auth yoksa None döner — read-only endpoint'ler için."""
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
        user_id = uuid.UUID(payload["sub"])
    except (TokenError, KeyError, ValueError):
        return None
    return await get_user_by_id(session, user_id)
