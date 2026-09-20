"""Application configuration via Pydantic Settings.

Reads from environment variables or a .env file (when python-dotenv is available).
All required secrets raise a clear error on startup if absent.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Application ─────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    APP_SECRET_KEY: str
    ALLOWED_ORIGINS: List[str] = ["http://localhost:8081"]

    # ── JWT ─────────────────────────────────────────────────────
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CARD_QUEUE_SIZE: int = 20

    # ── S3 / Object Storage ──────────────────────────────────────
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str
    S3_SECRET_ACCESS_KEY: str
    S3_BUCKET_NAME: str = "swiped-media"
    S3_REGION: str = "us-east-1"
    S3_USE_PATH_STYLE: bool = False

    # ── CDN ──────────────────────────────────────────────────────
    CDN_BASE_URL: str
    PRESIGNED_URL_TTL: int = 3600  # seconds

    # ── Rate Limiting ────────────────────────────────────────────
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = 10
    RATE_LIMIT_DECISIONS_PER_MINUTE: int = 120

    # ── Sentry ───────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── ARQ Worker ───────────────────────────────────────────────
    ARQ_REDIS_URL: str = "redis://localhost:6379/1"

    # ── File Upload ──────────────────────────────────────────────
    MAX_UPLOAD_SIZE_BYTES: int = 524_288_000  # 500 MB
    ALLOWED_IMAGE_TYPES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
    ]
    ALLOWED_VIDEO_TYPES: List[str] = [
        "video/mp4",
        "video/x-m4v",
        "application/x-mpegurl",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("ALLOWED_IMAGE_TYPES", "ALLOWED_VIDEO_TYPES", mode="before")
    @classmethod
    def parse_csv_list(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @property
    def allowed_media_types(self) -> List[str]:
        return self.ALLOWED_IMAGE_TYPES + self.ALLOWED_VIDEO_TYPES


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
