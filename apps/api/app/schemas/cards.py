"""Pydantic v2 schemas for Card and card feed."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.media import MediaAssetOut


class CardOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    metadata: dict[str, Any]
    primary_asset: MediaAssetOut | None
    gallery_assets: list[MediaAssetOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class CardFeedResponse(BaseModel):
    cards: list[CardOut]
    has_more: bool
    next_cursor: str | None = None
