/**
 * Session store — Zustand store for auth state.
 *
 * Persists access token in memory only (short-lived).
 * Refresh token is stored in SecureStore (handled in client.ts).
 */
import { create } from 'zustand';

interface SessionState {
  accessToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;

  setAccessToken: (token: string) => void;
  setUserId: (id: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  userId: null,
  isAuthenticated: false,

  setAccessToken: (token) =>
    set({ accessToken: token, isAuthenticated: true }),

  setUserId: (id) => set({ userId: id }),

  clearSession: () =>
    set({ accessToken: null, userId: null, isAuthenticated: false }),
}));
