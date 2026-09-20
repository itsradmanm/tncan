/**
 * usePrefetchQueue — preloads media for upcoming cards.
 *
 * While card[index] is visible, prefetches media for card[index+1]
 * and card[index+2] so that the next reveal is instant.
 *
 * Uses expo-image's Image.prefetch for images.
 * For video, we preload the playlist URL by making a tiny HEAD request
 * so the HLS manifest is cached in the device's HTTP cache.
 */
import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import type { CardOut } from '@/api/types';

const PREFETCH_AHEAD = 2;

interface UsePrefetchQueueProps {
  cards: CardOut[];
  currentIndex: number;
}

export function usePrefetchQueue({ cards, currentIndex }: UsePrefetchQueueProps) {
  const prefetchedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const upcomingIndices = Array.from(
      { length: PREFETCH_AHEAD },
      (_, i) => currentIndex + 1 + i,
    ).filter((i) => i < cards.length);

    for (const idx of upcomingIndices) {
      const card = cards[idx];
      if (!card?.primary_asset) continue;

      const asset = card.primary_asset;
      const key = asset.id;

      if (prefetchedKeys.current.has(key)) continue;
      prefetchedKeys.current.add(key);

      if (asset.media_type === 'image') {
        // Prefetch image into expo-image's native disk+memory cache
        const url =
          asset.variants?.['original'] ??
          asset.variants?.['360p'] ??
          null;
        if (url) {
          Image.prefetch(url).catch(() => {
            // Prefetch failure is non-fatal — the card will load on demand
            prefetchedKeys.current.delete(key);
          });
        }
      } else if (asset.media_type === 'video') {
        // Prefetch HLS manifest (lowest bitrate rendition for fast startup)
        const manifestUrl =
          asset.variants?.['360p'] ?? asset.variants?.['720p'] ?? null;
        if (manifestUrl) {
          fetch(manifestUrl, { method: 'HEAD' }).catch(() => {
            prefetchedKeys.current.delete(key);
          });
        }
      }
    }
  }, [cards, currentIndex]);
}
