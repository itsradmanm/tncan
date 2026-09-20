"""Redis connection pool management.

Uses redis-py async client. The connection is initialised once at startup
and torn down at shutdown via the FastAPI lifespan handler.
"""
from __future__ import annotations

import redis.asyncio as aioredis
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_redis: aioredis.Redis | None = None


async def init_redis() -> None:
    """Initialise the Redis connection pool. Called at application startup."""
    global _redis
    _redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )
    # Test connectivity
    await _redis.ping()
    log.info("redis_connected", url=settings.REDIS_URL)


async def close_redis() -> None:
    """Close the Redis connection pool. Called at application shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        log.info("redis_closed")


def get_redis() -> aioredis.Redis:
    """Return the active Redis client.

    Raises RuntimeError if Redis has not been initialised yet.
    """
    if _redis is None:
        raise RuntimeError("Redis has not been initialised. Was lifespan called?")
    return _redis
