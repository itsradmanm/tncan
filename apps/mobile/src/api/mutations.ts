/**
 * TanStack Query v5 mutations for swipe decisions and auth.
 *
 * Offline support: decisions are written to AsyncStorage when
 * the network is unavailable and flushed on reconnect.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';
import { queryKeys } from './queries';
import type { DecisionOut, DecisionRequest, TokenPair } from './types';

const OFFLINE_DECISIONS_KEY = 'offline_decisions';

// ─── Swipe Decision ──────────────────────────────────────────────────────────

async function persistDecisionOffline(req: DecisionRequest): Promise<void> {
  const existing = await AsyncStorage.getItem(OFFLINE_DECISIONS_KEY);
  const queue: DecisionRequest[] = existing ? JSON.parse(existing) : [];
  queue.push(req);
  await AsyncStorage.setItem(OFFLINE_DECISIONS_KEY, JSON.stringify(queue));
}

export async function flushOfflineDecisions(): Promise<void> {
  const existing = await AsyncStorage.getItem(OFFLINE_DECISIONS_KEY);
  if (!existing) return;

  const queue: DecisionRequest[] = JSON.parse(existing);
  if (queue.length === 0) return;

  const successful: string[] = [];
  for (const req of queue) {
    try {
      await apiClient.post<DecisionOut>('/decisions', req);
      successful.push(req.id);
    } catch {
      // Stop on first network failure; remaining stay queued
      break;
    }
  }

  if (successful.length > 0) {
    const remaining = queue.filter((r) => !successful.includes(r.id));
    if (remaining.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_DECISIONS_KEY);
    } else {
      await AsyncStorage.setItem(OFFLINE_DECISIONS_KEY, JSON.stringify(remaining));
    }
  }
}

export function useRecordDecision() {
  return useMutation<DecisionOut, Error, DecisionRequest>({
    mutationFn: async (req) => {
      // Simple connectivity check — avoids native NetInfo module
      let isOnline = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '') ?? 'http://localhost:8000'}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch {
        isOnline = false;
      }

      if (!isOnline) {
        // Offline: store for later sync
        await persistDecisionOffline(req);
        // Return an optimistic decision object so the UI can continue
        return {
          id: req.id,
          user_id: 'offline',
          card_id: req.card_id,
          direction: req.direction,
          created_at: new Date().toISOString(),
        } satisfies DecisionOut;
      }
      const { data } = await apiClient.post<DecisionOut>('/decisions', req);
      return data;
    },
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // Retry on network errors (no status) but not on 4xx client errors
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}

// ─── Auth mutations ──────────────────────────────────────────────────────────

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<TokenPair, Error, LoginRequest>({
    mutationFn: async (req) => {
      const { data } = await apiClient.post<TokenPair>('/auth/login', req);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useRegister() {
  return useMutation<TokenPair, Error, RegisterRequest>({
    mutationFn: async (req) => {
      const { data } = await apiClient.post<TokenPair>('/auth/register', req);
      return data;
    },
  });
}
