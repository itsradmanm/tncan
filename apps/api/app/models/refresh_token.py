"""RefreshToken model — allows server-side refresh token revocation."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Store the raw token string (hashed in production — simplified to raw here for clarity;
    # in high-security contexts, store bcrypt(token) and compare on validate)
    token: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @classmethod
    async def get_valid(
        cls, db: AsyncSession, token: str
    ) -> "RefreshToken | None":
        """Return a non-revoked, non-expired token record, or None."""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(cls).where(
                cls.token == token,
                cls.is_revoked == False,  # noqa: E712
                cls.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    def revoke(self) -> None:
        self.is_revoked = True
