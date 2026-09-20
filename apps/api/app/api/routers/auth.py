"""Auth router — register, login, refresh, logout, me."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut

router = APIRouter()


def _rate_limit_key(request: Request, action: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"rate:{action}:{ip}"


async def _check_rate_limit(request: Request, action: str, limit: int, db_redis=None):
    """Simple Redis-based rate limiting. Raises 429 if exceeded."""
    from app.core.redis_client import get_redis
    redis = get_redis()
    key = _rate_limit_key(request, action)
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)  # 1 minute window
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
        )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new user account and return a token pair."""
    await _check_rate_limit(request, "register", 10)

    existing = await User.get_by_email(db, body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()  # Get the generated UUID

    access_token = create_access_token(str(user.id))
    refresh_token_str = create_refresh_token(str(user.id))

    # Persist refresh token
    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)

    return TokenPair(access_token=access_token, refresh_token=refresh_token_str)


@router.post("/login", response_model=TokenPair)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user and return a new token pair."""
    await _check_rate_limit(request, "login", 20)

    user = await User.get_by_email(db, body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access_token = create_access_token(str(user.id))
    refresh_token_str = create_refresh_token(str(user.id))

    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)

    return TokenPair(access_token=access_token, refresh_token=refresh_token_str)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new token pair (rotation)."""
    await _check_rate_limit(request, "refresh", 30)

    # Validate JWT structure first
    try:
        user_id_str = decode_refresh_token(body.refresh_token)
        user_id = uuid.UUID(user_id_str)
    except (ValueError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Check the token is in the DB and not revoked
    rt = await RefreshToken.get_valid(db, body.refresh_token)
    if rt is None or rt.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or has been revoked",
        )

    # Revoke old token (rotation)
    rt.revoke()

    user = await User.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))

    new_rt = RefreshToken(
        user_id=user.id,
        token=new_refresh,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)

    return TokenPair(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Revoke the provided refresh token (server-side logout)."""
    rt = await RefreshToken.get_valid(db, body.refresh_token)
    if rt is not None and rt.user_id == _current_user.id:
        rt.revoke()


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return UserOut.model_validate(current_user)
