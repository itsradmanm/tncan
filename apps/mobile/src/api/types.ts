/**
 * Shared TypeScript types mirroring the backend Pydantic schemas.
 * These are kept in sync with the API manually — no codegen yet,
 * but the backend's /docs endpoint provides the reference.
 */

export type MediaType = 'image' | 'video' | 'file';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type SwipeDirection = 'left' | 'right';

export interface MediaAssetOut {
  id: string;
  media_type: MediaType;
  blurhash: string | null;
  duration_seconds: number | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  processing_status: ProcessingStatus;
  variants: Record<string, string>;
  created_at: string;
}

export interface CardOut {
  id: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  primary_asset: MediaAssetOut | null;
  gallery_assets: MediaAssetOut[];
  created_at: string;
}

export interface CardFeedResponse {
  cards: CardOut[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface DecisionRequest {
  id: string;              // Client-generated UUID
  card_id: string;
  direction: SwipeDirection;
}

export interface DecisionOut {
  id: string;
  user_id: string;
  card_id: string;
  direction: SwipeDirection;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UploadInitRequest {
  filename: string;
  content_type: string;
  file_size_bytes: number;
  checksum_sha256?: string;
}

export interface UploadInitResponse {
  asset_id: string;
  upload_url: string;
  upload_fields: Record<string, string>;
  expires_in_seconds: number;
}
