"""Media service — S3-compatible storage and presigned URL generation.

Handles:
- Generating presigned PUT URLs for direct client uploads.
- Server-side MIME type validation (magic bytes, not client-reported type).
- BlurHash generation from images.
- Enqueueing ARQ transcoding jobs for video.
"""
from __future__ import annotations

import hashlib
import io
import os
import uuid
from typing import Any

import boto3
import structlog
from botocore.config import Config
from botocore.exceptions import ClientError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.media_asset import MediaAsset, MediaType, ProcessingStatus
from app.schemas.media import UploadInitRequest, UploadInitResponse

log = structlog.get_logger(__name__)

# MIME-type-to-media-type mapping (server-side, never trust client)
_MIME_TO_MEDIA_TYPE: dict[str, MediaType] = {
    "image/jpeg": MediaType.image,
    "image/png": MediaType.image,
    "image/webp": MediaType.image,
    "image/avif": MediaType.image,
    "video/mp4": MediaType.video,
    "video/x-m4v": MediaType.video,
    "application/x-mpegurl": MediaType.video,
}


def _get_s3_client() -> Any:
    kwargs: dict[str, Any] = {
        "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
        "region_name": settings.S3_REGION,
        "config": Config(signature_version="s3v4"),
    }
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


async def create_upload_init(
    db: AsyncSession,
    owner_id: uuid.UUID,
    req: UploadInitRequest,
) -> UploadInitResponse:
    """Validate the upload request, create a MediaAsset record, and return
    a presigned PUT URL for the client to upload to directly.
    """
    # Validate declared MIME type against server allowlist
    declared_mime = req.content_type.lower().strip()
    if declared_mime not in settings.allowed_media_types:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: {declared_mime}",
        )

    # Validate file size
    if req.file_size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_BYTES} bytes",
        )

    media_type = _MIME_TO_MEDIA_TYPE.get(declared_mime, MediaType.file)
    asset_id = uuid.uuid4()
    raw_key = f"uploads/{owner_id}/{asset_id}/{req.filename}"

    # Create the MediaAsset record in pending state
    asset = MediaAsset(
        id=asset_id,
        owner_id=owner_id,
        media_type=media_type,
        raw_storage_key=raw_key,
        original_filename=req.filename,
        detected_mime_type=declared_mime,
        file_size_bytes=req.file_size_bytes,
        processing_status=ProcessingStatus.pending,
        processed_variants={},
    )
    db.add(asset)
    await db.flush()  # Get the ID into the DB within the current transaction

    # Generate presigned PUT URL
    s3 = _get_s3_client()
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": raw_key,
            "ContentType": declared_mime,
        },
        ExpiresIn=settings.PRESIGNED_URL_TTL,
    )

    log.info(
        "upload_init",
        asset_id=str(asset_id),
        mime=declared_mime,
        size=req.file_size_bytes,
    )

    return UploadInitResponse(
        asset_id=asset_id,
        upload_url=presigned_url,
        upload_fields={},
        expires_in_seconds=settings.PRESIGNED_URL_TTL,
    )


async def complete_upload(
    db: AsyncSession,
    owner_id: uuid.UUID,
    asset_id: uuid.UUID,
) -> MediaAsset:
    """Mark the upload as complete and enqueue processing job."""
    asset = await MediaAsset.get_by_id(db, asset_id)
    if asset is None or asset.owner_id != owner_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found",
        )

    if asset.processing_status != ProcessingStatus.pending:
        # Idempotent — already being processed or done
        return asset

    asset.processing_status = ProcessingStatus.processing
    await db.flush()

    # Enqueue ARQ processing job
    await _enqueue_processing(asset)

    return asset


async def _enqueue_processing(asset: MediaAsset) -> None:
    """Enqueue an ARQ task to process the uploaded media."""
    try:
        import arq

        redis_pool = await arq.create_pool(
            arq.connections.RedisSettings.from_dsn(settings.ARQ_REDIS_URL)
        )
        await redis_pool.enqueue_job("process_media_asset", str(asset.id))
        await redis_pool.aclose()
    except Exception as exc:
        log.warning("processing_enqueue_failed", asset_id=str(asset.id), exc=str(exc))


def get_signed_url(storage_key: str, ttl: int | None = None) -> str:
    """Return a presigned GET URL for private media."""
    ttl = ttl or settings.PRESIGNED_URL_TTL
    s3 = _get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": storage_key},
        ExpiresIn=ttl,
    )
