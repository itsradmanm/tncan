"""ARQ worker tasks for background media processing.

Workers:
1. process_media_asset — called after a successful S3 upload:
   - Downloads the raw file from S3
   - Validates magic bytes (server-side MIME check)
   - Generates BlurHash for images
   - Spawns FFmpeg transcoding for video
   - Updates the MediaAsset record in PostgreSQL

2. replenish_card_queue — refills the Redis card queue for a user.

Run the worker with:
    python -m arq app.workers.tasks.WorkerSettings
"""
from __future__ import annotations

import io
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

import boto3
import structlog
from botocore.config import Config
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings

log = structlog.get_logger(__name__)

# ─────────────────────────────────────────────────────────────
# S3 helpers (synchronous boto3 — fine in a worker process)
# ─────────────────────────────────────────────────────────────

def _s3():
    kwargs: dict[str, Any] = {
        "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
        "region_name": settings.S3_REGION,
        "config": Config(signature_version="s3v4"),
    }
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def _download_to_bytes(key: str) -> bytes:
    buf = io.BytesIO()
    _s3().download_fileobj(settings.S3_BUCKET_NAME, key, buf)
    return buf.getvalue()


def _upload_file(local_path: str, s3_key: str, content_type: str) -> str:
    """Upload a local file to S3 and return its CDN URL."""
    _s3().upload_file(
        local_path,
        settings.S3_BUCKET_NAME,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"{settings.CDN_BASE_URL.rstrip('/')}/{s3_key}"


# ─────────────────────────────────────────────────────────────
# BlurHash generation
# ─────────────────────────────────────────────────────────────

def _generate_blurhash(image_bytes: bytes) -> str | None:
    try:
        from PIL import Image
        import blurhash

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # Resize to small thumbnail before encoding (fast + small hash)
        img.thumbnail((64, 64))
        return blurhash.encode(img, x_components=4, y_components=3)
    except Exception as exc:
        log.warning("blurhash_failed", exc=str(exc))
        return None


# ─────────────────────────────────────────────────────────────
# Magic-bytes MIME detection
# ─────────────────────────────────────────────────────────────

def _detect_mime(data: bytes) -> str:
    """Detect MIME type from magic bytes (first 512 bytes sufficient)."""
    header = data[:512]
    # JPEG
    if header[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    # PNG
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    # WebP
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    # MP4 / ISO base media
    if header[4:8] in (b"ftyp", b"moov", b"mdat"):
        return "video/mp4"
    return "application/octet-stream"


# ─────────────────────────────────────────────────────────────
# Video transcoding via FFmpeg
# ─────────────────────────────────────────────────────────────

_VIDEO_RENDITIONS = [
    ("360p", "640x360", "500k"),
    ("720p", "1280x720", "2500k"),
    ("1080p", "1920x1080", "5000k"),
]


def _transcode_video(
    input_path: str,
    output_dir: str,
    asset_key_prefix: str,
) -> dict[str, str]:
    """Run FFmpeg to produce multi-bitrate HLS renditions.

    Returns a dict mapping rendition name → CDN URL.
    """
    variants: dict[str, str] = {}

    # Poster frame (thumbnail)
    poster_path = str(Path(output_dir) / "poster.jpg")
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ss", "00:00:01",
            "-vframes", "1",
            "-q:v", "2",
            poster_path,
        ],
        check=True,
        capture_output=True,
        timeout=60,
    )
    poster_key = f"{asset_key_prefix}/poster.jpg"
    variants["poster"] = _upload_file(poster_path, poster_key, "image/jpeg")

    # HLS renditions
    for name, scale, bitrate in _VIDEO_RENDITIONS:
        out_dir = str(Path(output_dir) / name)
        Path(out_dir).mkdir(exist_ok=True)
        hls_path = str(Path(out_dir) / "index.m3u8")
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-vf", f"scale={scale}",
                "-b:v", bitrate,
                "-hls_time", "6",
                "-hls_playlist_type", "vod",
                "-hls_segment_filename", str(Path(out_dir) / "seg%03d.ts"),
                hls_path,
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )
        # Upload playlist + segments
        for f in Path(out_dir).iterdir():
            s3_key = f"{asset_key_prefix}/{name}/{f.name}"
            ct = "application/x-mpegurl" if f.suffix == ".m3u8" else "video/mp2t"
            _upload_file(str(f), s3_key, ct)

        variants[name] = f"{settings.CDN_BASE_URL.rstrip('/')}/{asset_key_prefix}/{name}/index.m3u8"

    return variants


# ─────────────────────────────────────────────────────────────
# ARQ task: process_media_asset
# ─────────────────────────────────────────────────────────────

async def process_media_asset(ctx: dict, asset_id_str: str) -> None:
    """ARQ task — download, validate, process, and update a MediaAsset."""
    from app.models.media_asset import MediaAsset, ProcessingStatus

    asset_id = uuid.UUID(asset_id_str)
    log.info("processing_media_asset", asset_id=asset_id_str)

    # Create a fresh DB session for this worker invocation
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with SessionLocal() as db:
        try:
            asset = await MediaAsset.get_by_id(db, asset_id)
            if asset is None:
                log.error("asset_not_found", asset_id=asset_id_str)
                return

            # Download raw file
            raw_data = _download_to_bytes(asset.raw_storage_key)

            # Server-side MIME validation (magic bytes)
            detected_mime = _detect_mime(raw_data)
            asset.detected_mime_type = detected_mime

            processed_key_prefix = f"processed/{asset.owner_id}/{asset_id}"
            variants: dict[str, str] = {}

            if asset.media_type.value == "image":
                # Generate BlurHash
                asset.blurhash = _generate_blurhash(raw_data)

                # Upload processed image (original for now; could compress further)
                orig_key = f"{processed_key_prefix}/original.jpg"
                buf = io.BytesIO(raw_data)
                _s3().upload_fileobj(
                    buf,
                    settings.S3_BUCKET_NAME,
                    orig_key,
                    ExtraArgs={"ContentType": detected_mime},
                )
                variants["original"] = (
                    f"{settings.CDN_BASE_URL.rstrip('/')}/{orig_key}"
                )

            elif asset.media_type.value == "video":
                # Transcode to multi-bitrate HLS
                with tempfile.TemporaryDirectory() as tmpdir:
                    input_path = str(Path(tmpdir) / "input")
                    Path(input_path).write_bytes(raw_data)
                    variants = _transcode_video(input_path, tmpdir, processed_key_prefix)

                    # Try to get duration via ffprobe
                    try:
                        result = subprocess.run(
                            [
                                "ffprobe", "-v", "error",
                                "-show_entries", "format=duration",
                                "-of", "default=noprint_wrappers=1:nokey=1",
                                input_path,
                            ],
                            capture_output=True,
                            text=True,
                            timeout=30,
                        )
                        asset.duration_seconds = float(result.stdout.strip())
                    except Exception:
                        pass

            asset.processed_variants = variants
            asset.processing_status = ProcessingStatus.ready
            await db.commit()

            log.info(
                "media_asset_processed",
                asset_id=asset_id_str,
                variants=list(variants.keys()),
            )

        except Exception as exc:
            log.error("media_processing_failed", asset_id=asset_id_str, exc=str(exc))
            try:
                from app.models.media_asset import ProcessingStatus
                asset = await MediaAsset.get_by_id(db, asset_id)
                if asset:
                    asset.processing_status = ProcessingStatus.failed
                    asset.processing_error = str(exc)
                    await db.commit()
            except Exception:
                pass
        finally:
            await engine.dispose()


# ─────────────────────────────────────────────────────────────
# ARQ task: replenish_card_queue
# ─────────────────────────────────────────────────────────────

async def replenish_card_queue(ctx: dict, user_id_str: str) -> None:
    """ARQ task — refill the Redis card queue for a user."""
    import redis.asyncio as aioredis
    from sqlalchemy import not_, select

    user_id = uuid.UUID(user_id_str)
    log.info("replenishing_card_queue", user_id=user_id_str)

    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

    try:
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        queue_key = f"card_queue:{user_id}"
        seen_key = f"seen_cards:{user_id}"

        seen_ids_str = await redis.smembers(seen_key)
        seen_ids = {uuid.UUID(s) for s in seen_ids_str}

        async with SessionLocal() as db:
            from app.models.card import Card
            from app.models.swipe_decision import SwipeDecision

            decided = await db.execute(
                select(SwipeDecision.card_id).where(
                    SwipeDecision.user_id == user_id
                )
            )
            decided_ids = {row[0] for row in decided}
            all_excluded = seen_ids | decided_ids

            stmt = (
                select(Card.id)
                .where(Card.is_active == True)  # noqa: E712
                .order_by(Card.created_at.desc())
                .limit(settings.REDIS_CARD_QUEUE_SIZE)
            )
            if all_excluded:
                stmt = stmt.where(not_(Card.id.in_(all_excluded)))

            result = await db.execute(stmt)
            card_ids = [str(row[0]) for row in result]

        if card_ids:
            await redis.rpush(queue_key, *card_ids)
            await redis.expire(queue_key, 3600)  # TTL 1h

        await redis.aclose()
        log.info(
            "card_queue_replenished",
            user_id=user_id_str,
            count=len(card_ids),
        )
    finally:
        await engine.dispose()


# ─────────────────────────────────────────────────────────────
# ARQ WorkerSettings
# ─────────────────────────────────────────────────────────────

class WorkerSettings:
    functions = [process_media_asset, replenish_card_queue]
    redis_settings_str = settings.ARQ_REDIS_URL
    max_jobs = 10
    job_timeout = 600  # 10 minutes max per job
