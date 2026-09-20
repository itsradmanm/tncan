"""Initial schema — all tables.

Revision ID: 0001
Revises:
Create Date: 2026-09-20

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ────────────────────────────────────────────────────
    media_type_enum = postgresql.ENUM(
        "image", "video", "file", name="media_type_enum", create_type=True
    )
    processing_status_enum = postgresql.ENUM(
        "pending", "processing", "ready", "failed",
        name="processing_status_enum", create_type=True,
    )
    swipe_direction_enum = postgresql.ENUM(
        "left", "right", name="swipe_direction_enum", create_type=True
    )

    media_type_enum.create(op.get_bind(), checkfirst=True)
    processing_status_enum.create(op.get_bind(), checkfirst=True)
    swipe_direction_enum.create(op.get_bind(), checkfirst=True)

    # ── users ────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("display_name", sa.String(100)),
        sa.Column("avatar_url", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── refresh_tokens ───────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.Text, nullable=False),
        sa.Column("is_revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)

    # ── media_assets ─────────────────────────────────────────────
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_type", media_type_enum, nullable=False),
        sa.Column("raw_storage_key", sa.Text, nullable=False),
        sa.Column(
            "processed_variants",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("blurhash", sa.String(100)),
        sa.Column("duration_seconds", sa.Float),
        sa.Column("original_filename", sa.String(512)),
        sa.Column("detected_mime_type", sa.String(128)),
        sa.Column("file_size_bytes", sa.BigInteger),
        sa.Column("processing_status", processing_status_enum, nullable=False),
        sa.Column("processing_error", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_media_assets_owner_id", "media_assets", ["owner_id"])
    op.create_index(
        "ix_media_assets_processing_status",
        "media_assets",
        ["processing_status"],
    )

    # ── cards ────────────────────────────────────────────────────
    op.create_table(
        "cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("primary_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "gallery_asset_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_cards_primary_asset_id", "cards", ["primary_asset_id"])
    op.create_index("ix_cards_creator_id", "cards", ["creator_id"])
    op.create_index("ix_cards_is_active", "cards", ["is_active"])
    op.create_index("ix_cards_created_at", "cards", ["created_at"])

    # ── swipe_decisions ──────────────────────────────────────────
    op.create_table(
        "swipe_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("direction", swipe_direction_enum, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_swipe_decisions_user_id", "swipe_decisions", ["user_id"])
    op.create_index("ix_swipe_decisions_card_id", "swipe_decisions", ["card_id"])
    op.create_index("ix_swipe_decisions_created_at", "swipe_decisions", ["created_at"])
    op.create_unique_constraint(
        "uq_user_card_decision", "swipe_decisions", ["user_id", "card_id"]
    )


def downgrade() -> None:
    op.drop_table("swipe_decisions")
    op.drop_table("cards")
    op.drop_table("media_assets")
    op.drop_table("refresh_tokens")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS swipe_direction_enum")
    op.execute("DROP TYPE IF EXISTS processing_status_enum")
    op.execute("DROP TYPE IF EXISTS media_type_enum")
