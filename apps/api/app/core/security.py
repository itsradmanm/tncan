"""Security utilities: JWT creation/validation and password hashing.

Design decisions:
- Access tokens expire in 15 minutes (configurable).
- Refresh tokens expire in 7 days (configurable) and are stored in the DB
  (so they can be revoked on logout).
- Passwords are hashed with bcrypt via passlib.
- JWT secret is the APP_SECRET_KEY; algorithm is HS256.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ─────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt-hashed password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


# ── JWT ──────────────────────────────────────────────────────

_SECRET = settings.APP_SECRET_KEY
_ALGORITHM = settings.JWT_ALGORITHM


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def _decode(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])


def create_access_token(subject: str) -> str:
    """Create a short-lived access token for *subject* (user id as str)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return _encode({"sub": subject, "type": "access", "exp": expire})


def create_refresh_token(subject: str) -> str:
    """Create a long-lived refresh token for *subject*."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    return _encode({"sub": subject, "type": "refresh", "exp": expire})


def decode_access_token(token: str) -> str:
    """Decode an access token and return the subject (user id).

    Raises ValueError with a human-readable message on any failure.
    """
    try:
        payload = _decode(token)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Token missing subject")
        return str(sub)
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc


def decode_refresh_token(token: str) -> str:
    """Decode a refresh token and return the subject (user id)."""
    try:
        payload = _decode(token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Token missing subject")
        return str(sub)
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc
