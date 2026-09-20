"""FastAPI dependency for extracting the authenticated user from a JWT.

Usage in a route:
    @router.get("/protected")
    async def protected(current_user: User = Depends(get_current_user)):
        ...
"""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the Bearer JWT, return the corresponding User.

    Raises HTTP 401 on any auth failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id_str = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(user_id_str)
    except (ValueError, Exception):
        raise credentials_exception

    user = await User.get_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    return user
