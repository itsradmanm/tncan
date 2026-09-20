"""Cards router — card feed for the authenticated user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.cards import CardFeedResponse
from app.services import card_feed

router = APIRouter()


@router.get("/feed", response_model=CardFeedResponse)
async def get_card_feed(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the next batch of cards for the authenticated user.

    Cards are drawn from a per-user Redis queue (pre-computed), falling
    back to a direct DB query if the queue is empty.
    """
    return await card_feed.get_feed(db, current_user.id, limit=limit)
