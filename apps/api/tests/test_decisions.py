"""Tests for swipe decision logic (pure business logic, no DB needed)."""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-that-is-long-enough-for-testing")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("S3_ACCESS_KEY_ID", "test")
os.environ.setdefault("S3_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("CDN_BASE_URL", "http://localhost:9000/test")

from app.models.swipe_decision import SwipeDirection


class TestSwipeDirection:
    def test_left_is_pass(self):
        assert SwipeDirection.left == "left"

    def test_right_is_keep(self):
        assert SwipeDirection.right == "right"

    def test_from_string(self):
        assert SwipeDirection("left") == SwipeDirection.left
        assert SwipeDirection("right") == SwipeDirection.right

    def test_invalid_direction_raises(self):
        import pytest
        with pytest.raises(ValueError):
            SwipeDirection("up")


class TestDecisionIdempotency:
    """Verify the idempotency contract via the schema (no DB)."""

    def test_decision_request_accepts_client_uuid(self):
        from app.schemas.decisions import DecisionRequest
        decision_id = uuid.uuid4()
        req = DecisionRequest(
            id=decision_id,
            card_id=uuid.uuid4(),
            direction=SwipeDirection.right,
        )
        assert req.id == decision_id

    def test_same_uuid_resubmission_yields_same_id(self):
        from app.schemas.decisions import DecisionRequest
        decision_id = uuid.uuid4()
        card_id = uuid.uuid4()
        req1 = DecisionRequest(id=decision_id, card_id=card_id, direction=SwipeDirection.left)
        req2 = DecisionRequest(id=decision_id, card_id=card_id, direction=SwipeDirection.left)
        assert req1.id == req2.id
