"""Pydantic v2 schemas for swipe decisions."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.swipe_decision import SwipeDirection


class DecisionRequest(BaseModel):
    """Client sends a client-generated UUID for idempotency."""
    id: uuid.UUID = Field(description="Client-generated UUID for idempotent retries")
    card_id: uuid.UUID
    direction: SwipeDirection


class DecisionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    card_id: uuid.UUID
    direction: SwipeDirection
    created_at: datetime

    model_config = {"from_attributes": True}


class DecisionHistoryResponse(BaseModel):
    decisions: list[DecisionOut]
    total: int
    has_more: bool
