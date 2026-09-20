"""Tests for security utilities (pure functions — no DB or network needed)."""
from __future__ import annotations

import os
import time

# Set required env vars before importing anything from app
os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-that-is-long-enough-for-testing")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("S3_ACCESS_KEY_ID", "test")
os.environ.setdefault("S3_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("CDN_BASE_URL", "http://localhost:9000/test")

import pytest
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        plain = "my-secure-password-123"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_verify_correct_password(self):
        plain = "my-secure-password-123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_different_hashes_for_same_password(self):
        # bcrypt uses random salts
        plain = "same-password"
        assert hash_password(plain) != hash_password(plain)


class TestJWT:
    def test_access_token_roundtrip(self):
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        token = create_access_token(user_id)
        assert isinstance(token, str)
        decoded = decode_access_token(token)
        assert decoded == user_id

    def test_refresh_token_roundtrip(self):
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        token = create_refresh_token(user_id)
        decoded = decode_refresh_token(token)
        assert decoded == user_id

    def test_access_token_rejected_as_refresh(self):
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        access = create_access_token(user_id)
        with pytest.raises(ValueError, match="Not a refresh token"):
            decode_refresh_token(access)

    def test_refresh_token_rejected_as_access(self):
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        refresh = create_refresh_token(user_id)
        with pytest.raises(ValueError, match="Not an access token"):
            decode_access_token(refresh)

    def test_tampered_token_rejected(self):
        token = create_access_token("user-123")
        # Flip a byte in the signature
        tampered = token[:-4] + "XXXX"
        with pytest.raises(ValueError):
            decode_access_token(tampered)

    def test_invalid_token_string_rejected(self):
        with pytest.raises(ValueError):
            decode_access_token("not.a.valid.jwt")
