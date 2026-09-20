"""SwipeDeck API — Application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api.routers import auth, cards, decisions, media
from app.core.config import settings
from app.core.database import engine
from app.core.redis_client import close_redis, init_redis

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: startup and shutdown."""
    # ── Startup ────────────────────────────────────────────────
    log.info("starting_up", env=settings.APP_ENV)
    await init_redis()
    yield
    # ── Shutdown ───────────────────────────────────────────────
    log.info("shutting_down")
    await close_redis()
    await engine.dispose()


def create_app() -> FastAPI:
    """Factory function — creates and configures the FastAPI application."""
    # Configure Sentry before anything else so it captures startup errors
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            integrations=[
                StarletteIntegration(transaction_style="url"),
                FastApiIntegration(transaction_style="url"),
            ],
            traces_sample_rate=0.2,
        )

    app = FastAPI(
        title="SwipeDeck API",
        description="Production-grade swipe-card discovery API",
        version="1.0.0",
        docs_url="/docs" if settings.APP_DEBUG else None,
        redoc_url="/redoc" if settings.APP_DEBUG else None,
        lifespan=lifespan,
    )

    # ── CORS ───────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(cards.router, prefix="/api/v1/cards", tags=["cards"])
    app.include_router(decisions.router, prefix="/api/v1/decisions", tags=["decisions"])
    app.include_router(media.router, prefix="/api/v1/media", tags=["media"])

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok", "env": settings.APP_ENV}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.APP_DEBUG,
        log_level="info",
    )
