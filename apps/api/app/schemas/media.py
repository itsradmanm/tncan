"""Pydantic v2 schemas for media upload flow."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.media_asset import MediaType, ProcessingStatus


class UploadInitRequest(BaseModel):
    """Client sends this before the direct-to-S3 upload."""
    filename: str = Field(max_length=512)
    content_type: str = Field(max_length=128)
    file_size_bytes: int = Field(gt=0)
    # SHA-256 hex digest of the file (optional but recommended for integrity check)
    checksum_sha256: str | None = Field(None, max_length=64)


class UploadInitResponse(BaseModel):
    """API returns this with a presigned PUT URL."""
    asset_id: uuid.UUID
    upload_url: str          # Presigned S3 PUT URL
    upload_fields: dict      # For POST presigned forms (empty for PUT)
    expires_in_seconds: int  # When the presigned URL expires


class UploadCompleteRequest(BaseModel):
    """Client calls this after a successful PUT to S3."""
    asset_id: uuid.UUID


class MediaAssetOut(BaseModel):
    id: uuid.UUID
    media_type: MediaType
    blurhash: str | None
    duration_seconds: float | None
    original_filename: str | None
    file_size_bytes: int | None
    processing_status: ProcessingStatus
    # CDN URLs for each variant (populated when status == ready)
    variants: dict = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_asset(cls, asset: object) -> "MediaAssetOut":
        from app.models.media_asset import MediaAsset  # avoid circular import
        a: MediaAsset = asset  # type: ignore[assignment]
        return cls(
            id=a.id,
            media_type=a.media_type,
            blurhash=a.blurhash,
            duration_seconds=a.duration_seconds,
            original_filename=a.original_filename,
            file_size_bytes=a.file_size_bytes,
            processing_status=a.processing_status,
            variants=a.processed_variants or {},
            created_at=a.created_at,
        )
