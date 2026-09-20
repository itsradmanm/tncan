"""Tests for worker magic-bytes MIME detection (pure function)."""
from __future__ import annotations

import os

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-that-is-long-enough-for-testing")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("S3_ACCESS_KEY_ID", "test")
os.environ.setdefault("S3_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("CDN_BASE_URL", "http://localhost:9000/test")

from app.workers.tasks import _detect_mime


class TestMagicBytesMimeDetection:
    def test_detects_jpeg(self):
        # JPEG magic bytes: FF D8 FF
        data = b"\xff\xd8\xff\xe0" + b"\x00" * 508
        assert _detect_mime(data) == "image/jpeg"

    def test_detects_png(self):
        # PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 504
        assert _detect_mime(data) == "image/png"

    def test_detects_webp(self):
        # WebP: RIFF....WEBP
        data = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 500
        assert _detect_mime(data) == "image/webp"

    def test_detects_mp4(self):
        # MP4 ISO base: ....ftyp
        data = b"\x00\x00\x00\x20ftyp" + b"\x00" * 505
        assert _detect_mime(data) == "video/mp4"

    def test_unknown_returns_octet_stream(self):
        data = b"\x00\x01\x02\x03" + b"\x00" * 508
        assert _detect_mime(data) == "application/octet-stream"
