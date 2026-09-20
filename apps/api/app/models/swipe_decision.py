"""SQLAlchemy ORM model — SwipeDecision.

Design: Append-only. A decision is never mutated after creation.
The client supplies a UUID (decision_id) for idempotency — retrying
a POST /decisions with the same UUID is safe (returns 200, not 409).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class SwipeDirection(str, enum.Enum):
    left = "left"    # pass / reject
    right = "right"  # like / keep


class SwipeDecision(Base):
    __tablename__ = "swipe_decisions"

    # Client-generated UUID — enables idempotent retries
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    direction: Mapped[SwipeDirection] = mapped_column(
        Enum(SwipeDirection, name="swipe_direction_enum"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Enforce one decision per (user, card) pair — prevents duplicates
    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_user_card_decision"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="decisions", lazy="noload")

    @classmethod
    async def get_by_id(
        cls, db: AsyncSession, decision_id: uuid.UUID
    ) -> "SwipeDecision | None":
        result = await db.execute(select(cls).where(cls.id == decision_id))
        return result.scalar_one_or_none()

    @classmethod
    async def get_user_decision_for_card(
        cls, db: AsyncSession, user_id: uuid.UUID, card_id: uuid.UUID
    ) -> "SwipeDecision | None":
        result = await db.execute(
            select(cls).where(cls.user_id == user_id, cls.card_id == card_id)
        )
        return result.scalar_one_or_none()

    def __repr__(self) -> str:
        return f"<SwipeDecision id={self.id} user={self.user_id} card={self.card_id} dir={self.direction}>"
