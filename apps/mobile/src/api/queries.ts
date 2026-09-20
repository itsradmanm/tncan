/**
 * TanStack Query v5 queries for the SwipeDeck app.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { CardFeedResponse, UserOut } from './types';

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const queryKeys = {
  feed: ['cards', 'feed'] as const,
  me: ['auth', 'me'] as const,
  asset: (id: string) => ['media', 'asset', id] as const,
};

// ─── Card Feed ───────────────────────────────────────────────────────────────
export function useCardFeed() {
  return useInfiniteQuery<CardFeedResponse, Error>({
    queryKey: queryKeys.feed,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, unknown> = { limit: 10 };
      if (pageParam) params.cursor = pageParam;
      const { data } = await apiClient.get<CardFeedResponse>('/cards/feed', {
        params,
      });
      return data;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });
}

// ─── Current User ────────────────────────────────────────────────────────────
export function useCurrentUser() {
  return useQuery<UserOut, Error>({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const { data } = await apiClient.get<UserOut>('/auth/me');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      // Don't retry on 401 — user needs to log in
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
