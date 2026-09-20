"""SQLAlchemy ORM model — MediaAsset."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Enum, Float, String, Text, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
    file = "file"


class ProcessingStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    media_type: Mapped[MediaType] = mapped_column(
        Enum(MediaType, name="media_type_enum"), nullable=False
    )
    # Key under which the raw upload is stored in S3
    raw_storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    # JSONB map: {"360p": "<cdn_url>", "720p": "<cdn_url>", "original": "<cdn_url>"}
    processed_variants: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # BlurHash compact string for instant placeholder rendering
    blurhash: Mapped[str | None] = mapped_column(String(100))
    # Video duration in seconds (null for images/files)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    # Human-readable file name (as uploaded)
    original_filename: Mapped[str | None] = mapped_column(String(512))
    # MIME type as detected server-side (never trust client)
    detected_mime_type: Mapped[str | None] = mapped_column(String(128))
    # File size in bytes
    file_size_bytes: Mapped[int | None] = mapped_column()
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus, name="processing_status_enum"),
        nullable=False,
        default=ProcessingStatus.pending,
        index=True,
    )
    processing_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @classmethod
    async def get_by_id(
        cls, db: AsyncSession, asset_id: uuid.UUID
    ) -> "MediaAsset | None":
        result = await db.execute(select(cls).where(cls.id == asset_id))
        return result.scalar_one_or_none()

    def __repr__(self) -> str:
        return f"<MediaAsset id={self.id} type={self.media_type} status={self.processing_status}>"
