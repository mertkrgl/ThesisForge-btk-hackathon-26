"""Auth endpoints — register/login/me/refresh (P1).

Akış:
  POST /api/auth/register  → email + password (+ name)         → tokens + user
  POST /api/auth/login     → email + password                  → tokens + user
  POST /api/auth/refresh   → refresh_token (request body)      → yeni access_token
  GET  /api/auth/me        → Authorization: Bearer <access>    → user

Şifre kuralı: min 8 karakter (uygulama katmanında, pydantic validator).
Email: pydantic EmailStr — DNS doğrulaması yok (offline'da bozulmasın), sadece
format.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import User
from app.db.repo import (
    create_user_with_password,
    get_user_by_email,
    get_user_by_id,
    update_last_login,
)
from app.db.session import get_session


router = APIRouter(prefix="/api/auth", tags=["auth"])


# ──────────────────────────── Schemas ────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    tier: str
    user_mode: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


def _user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        tier=user.tier,
        user_mode=user.user_mode,
    )


# ──────────────────────────── Endpoints ────────────────────────────


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    req: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    email_norm = req.email.lower().strip()
    existing = await get_user_by_email(session, email_norm)
    if existing is not None:
        # Email çakışması — 409 Conflict. password_hash null olsa bile (demo
        # user'lar için) çakışma sayılır; o demo emaili kimse seçemez zaten
        # çünkü `demo-<uuid>@thesisforge.local` formatında.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu email zaten kayıtlı.",
        )
    password_hash = hash_password(req.password)
    user = await create_user_with_password(
        session,
        email=email_norm,
        password_hash=password_hash,
        name=req.name,
    )
    await update_last_login(session, user.id)
    await session.commit()
    # Yeni session refresh — last_login_at update'ini görsün
    await session.refresh(user)

    return TokenPair(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id, user.email),
        user=_user_public(user),
    )


@router.post("/login", response_model=TokenPair)
async def login(
    req: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    email_norm = req.email.lower().strip()
    user = await get_user_by_email(session, email_norm)
    # Aynı 401 mesajı — email var/yok bilgisini sızdırmayalım (user enumeration
    # önlemi). Demo user'lar password_hash=null olduğu için verify_password
    # False döner; onlar da bu hatayı alır.
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email veya şifre hatalı.",
        )
    await update_last_login(session, user.id)
    await session.commit()
    await session.refresh(user)

    return TokenPair(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id, user.email),
        user=_user_public(user),
    )


@router.post("/refresh", response_model=dict[str, Any])
async def refresh(
    req: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    try:
        payload = decode_token(req.refresh_token, expected_type="refresh")
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hesap bulunamadı.",
        )
    return {
        "access_token": create_access_token(user.id, user.email),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserPublic)
async def me(current: User = Depends(get_current_user)) -> UserPublic:
    return _user_public(current)


@router.post("/password", response_model=dict[str, bool])
async def change_password(
    req: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    if not verify_password(req.current_password, current.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre hatalı.",
        )
    current.password_hash = hash_password(req.new_password)
    session.add(current)
    await session.commit()
    return {"ok": True}
