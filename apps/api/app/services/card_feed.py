"""Card feed service — Redis-backed hot queue per user.

Design:
- Pre-compute and cache the next REDIS_CARD_QUEUE_SIZE card IDs per user in Redis.
- The queue is a Redis list: key = "card_queue:{user_id}"
- On GET /cards/feed: pop N items from the Redis list; if it drops below a threshold,
  enqueue a background replenishment job via ARQ.
- Cards already seen by the user are filtered out via a Redis set:
  key = "seen_cards:{user_id}"
- Decisions are also persisted to PostgreSQL for durability.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

import structlog
from sqlalchemy import and_, not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import get_redis
from app.models.card import Card
from app.models.media_asset import MediaAsset, ProcessingStatus
from app.models.swipe_decision import SwipeDecision
from app.schemas.cards import CardFeedResponse, CardOut
from app.schemas.media import MediaAssetOut

log = structlog.get_logger(__name__)

_QUEUE_KEY = "card_queue:{user_id}"
_SEEN_KEY = "seen_cards:{user_id}"
_REPLENISH_THRESHOLD = 5


def _queue_key(user_id: uuid.UUID) -> str:
    return f"card_queue:{user_id}"


def _seen_key(user_id: uuid.UUID) -> str:
    return f"seen_cards:{user_id}"


async def get_feed(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> CardFeedResponse:
    """Return the next *limit* cards for the user.

    1. Pop up to *limit* card IDs from the Redis queue.
    2. If fewer than *limit* are available, fall back to a DB query.
    3. Fetch full card + media data from PostgreSQL.
    4. Return a CardFeedResponse.
    """
    redis = get_redis()
    queue_key = _queue_key(user_id)
    seen_key = _seen_key(user_id)

    # Pop from Redis list (atomic)
    card_id_strs: list[str] = []
    for _ in range(limit):
        val = await redis.lpop(queue_key)
        if val is None:
            break
        card_id_strs.append(val)

    card_ids = [uuid.UUID(cid) for cid in card_id_strs]

    # If we didn't get enough from Redis, fall back to DB
    if len(card_ids) < limit:
        db_cards = await _fetch_unseen_cards(
            db, user_id, seen_key, limit - len(card_ids), exclude=card_ids
        )
        card_ids.extend(db_cards)

    if not card_ids:
        return CardFeedResponse(cards=[], has_more=False)

    # Fetch full card data (with primary + gallery assets)
    cards_out = await _build_card_out_list(db, card_ids)

    # Mark as seen
    if card_ids:
        await redis.sadd(seen_key, *[str(cid) for cid in card_ids])

    # Trigger replenishment if queue is getting low
    remaining = await redis.llen(queue_key)
    if remaining < _REPLENISH_THRESHOLD:
        await _enqueue_replenishment(user_id)

    has_more = remaining > 0 or len(cards_out) == limit

    return CardFeedResponse(cards=cards_out, has_more=has_more)


async def _fetch_unseen_cards(
    db: AsyncSession,
    user_id: uuid.UUID,
    seen_key: str,
    limit: int,
    exclude: list[uuid.UUID],
) -> list[uuid.UUID]:
    """Fetch card IDs not yet seen by the user, directly from the DB."""
    redis = get_redis()

    # Get seen card IDs from Redis set
    seen_ids_str = await redis.smembers(seen_key)
    seen_ids = {uuid.UUID(s) for s in seen_ids_str}

    # Also exclude already-decided cards from DB
    decided_result = await db.execute(
        select(SwipeDecision.card_id).where(SwipeDecision.user_id == user_id)
    )
    decided_ids = {row[0] for row in decided_result}

    all_excluded = seen_ids | decided_ids | set(exclude)

    stmt = (
        select(Card.id)
        .where(Card.is_active == True)  # noqa: E712
        .order_by(Card.created_at.desc())
        .limit(limit)
    )
    if all_excluded:
        stmt = stmt.where(not_(Card.id.in_(all_excluded)))

    result = await db.execute(stmt)
    return [row[0] for row in result]


async def _build_card_out_list(
    db: AsyncSession,
    card_ids: list[uuid.UUID],
) -> list[CardOut]:
    """Build CardOut objects for the given card IDs."""
    if not card_ids:
        return []

    result = await db.execute(select(Card).where(Card.id.in_(card_ids)))
    cards: list[Card] = list(result.scalars())

    # Preserve requested order
    card_map = {c.id: c for c in cards}
    ordered_cards = [card_map[cid] for cid in card_ids if cid in card_map]

    # Collect all asset IDs to fetch in a single query
    all_asset_ids: set[uuid.UUID] = set()
    for card in ordered_cards:
        all_asset_ids.add(card.primary_asset_id)
        for gid in (card.gallery_asset_ids or []):
            all_asset_ids.add(gid)

    asset_result = await db.execute(
        select(MediaAsset).where(MediaAsset.id.in_(all_asset_ids))
    )
    asset_map: dict[uuid.UUID, MediaAsset] = {
        a.id: a for a in asset_result.scalars()
    }

    out: list[CardOut] = []
    for card in ordered_cards:
        primary_asset = asset_map.get(card.primary_asset_id)
        gallery_assets = [
            asset_map[gid]
            for gid in (card.gallery_asset_ids or [])
            if gid in asset_map
        ]
        out.append(
            CardOut(
                id=card.id,
                title=card.title,
                description=card.description,
                metadata=card.metadata or {},
                primary_asset=(
                    MediaAssetOut.from_orm_asset(primary_asset)
                    if primary_asset
                    else None
                ),
                gallery_assets=[
                    MediaAssetOut.from_orm_asset(a) for a in gallery_assets
                ],
                created_at=card.created_at,
            )
        )

    return out


async def _enqueue_replenishment(user_id: uuid.UUID) -> None:
    """Push a replenishment job to ARQ (best-effort, never raises)."""
    try:
        import arq

        redis_pool = await arq.create_pool(
            arq.connections.RedisSettings.from_dsn(settings.ARQ_REDIS_URL)
        )
        await redis_pool.enqueue_job("replenish_card_queue", str(user_id))
        await redis_pool.aclose()
    except Exception as exc:
        log.warning("replenishment_enqueue_failed", exc=str(exc))
