"""Media router — upload init, upload complete, and asset status."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.schemas.media import MediaAssetOut, UploadCompleteRequest, UploadInitRequest, UploadInitResponse
from app.services import media as media_service

router = APIRouter()


async def _check_upload_rate_limit(request: Request) -> None:
    """Rate limit: max 10 upload inits per minute per IP."""
    from fastapi import HTTPException
    from app.core.config import settings
    from app.core.redis_client import get_redis
    redis = get_redis()
    ip = request.client.host if request.client else "unknown"
    key = f"rate:upload:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > settings.RATE_LIMIT_UPLOAD_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Upload rate limit exceeded",
        )


@router.post(
    "/upload-init",
    response_model=UploadInitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_init(
    request: Request,
    body: UploadInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 1: Get a presigned S3 PUT URL.

    Client validates file locally then calls this to receive a time-limited
    direct-upload URL. The binary never passes through the API server.
    """
    await _check_upload_rate_limit(request)
    return await media_service.create_upload_init(db, current_user.id, body)


@router.post("/upload-complete", response_model=MediaAssetOut)
async def upload_complete(
    body: UploadCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Notify API that the direct S3 upload is done.

    This triggers background processing (BlurHash, transcoding).
    """
    asset = await media_service.complete_upload(db, current_user.id, body.asset_id)
    return MediaAssetOut.from_orm_asset(asset)


@router.get("/{asset_id}", response_model=MediaAssetOut)
async def get_asset(
    asset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the processing status of a media asset.

    Returns the current state including CDN URLs once processing is complete.
    """
    from fastapi import HTTPException
    asset = await MediaAsset.get_by_id(db, asset_id)
    if asset is None or asset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return MediaAssetOut.from_orm_asset(asset)
