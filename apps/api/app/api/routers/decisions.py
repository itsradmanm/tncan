"""Decisions router — record swipe decisions (append-only, idempotent)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.swipe_decision import SwipeDecision
from app.models.user import User
from app.schemas.decisions import DecisionHistoryResponse, DecisionOut, DecisionRequest

router = APIRouter()


async def _check_decision_rate_limit(request: Request) -> None:
    """Rate limit: max 120 decisions per minute per user IP."""
    from app.core.config import settings
    from app.core.redis_client import get_redis
    redis = get_redis()
    ip = request.client.host if request.client else "unknown"
    key = f"rate:decisions:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > settings.RATE_LIMIT_DECISIONS_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Decision rate limit exceeded",
        )


@router.post("", response_model=DecisionOut, status_code=status.HTTP_200_OK)
async def record_decision(
    request: Request,
    body: DecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a swipe decision (idempotent).

    The client supplies a UUID in the request body. If a decision with
    that UUID already exists and belongs to the same user + card, the
    existing record is returned (HTTP 200, not 409). This makes retries safe.
    """
    await _check_decision_rate_limit(request)

    # Check if this exact decision_id already exists (idempotent retry)
    existing = await SwipeDecision.get_by_id(db, body.id)
    if existing is not None:
        if existing.user_id != current_user.id:
            # UUID collision from a different user — extremely unlikely but reject it
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Decision ID already used by another user",
            )
        return DecisionOut.model_validate(existing)

    # Check if user already has a decision for this card (different decision ID)
    duplicate = await SwipeDecision.get_user_decision_for_card(
        db, current_user.id, body.card_id
    )
    if duplicate is not None:
        return DecisionOut.model_validate(duplicate)

    decision = SwipeDecision(
        id=body.id,
        user_id=current_user.id,
        card_id=body.card_id,
        direction=body.direction,
    )
    db.add(decision)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # Race condition — another request beat us; fetch and return existing
        existing = await SwipeDecision.get_user_decision_for_card(
            db, current_user.id, body.card_id
        )
        if existing:
            return DecisionOut.model_validate(existing)
        raise

    return DecisionOut.model_validate(decision)


@router.get("/history", response_model=DecisionHistoryResponse)
async def get_decision_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's swipe decision history."""
    offset = (page - 1) * page_size

    total_result = await db.execute(
        select(func.count()).where(SwipeDecision.user_id == current_user.id)
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(SwipeDecision)
        .where(SwipeDecision.user_id == current_user.id)
        .order_by(SwipeDecision.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    decisions = list(result.scalars())

    return DecisionHistoryResponse(
        decisions=[DecisionOut.model_validate(d) for d in decisions],
        total=total,
        has_more=(offset + page_size) < total,
    )
