/**
 * Axios HTTP client with JWT interceptor and automatic token refresh.
 *
 * Features:
 * - Reads access token from sessionStore (Zustand)
 * - On 401: attempts token refresh via refresh_token from SecureStore
 * - Queues concurrent requests during refresh (avoids multiple refresh calls)
 * - On refresh failure: clears session and redirects to login
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '@/state/sessionStore';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ─────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useSessionStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response interceptor: handle 401 → refresh ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] =
            `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });

      // Persist new tokens
      useSessionStore.getState().setAccessToken(data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);

      processQueue(null, data.access_token);

      if (originalRequest.headers) {
        (originalRequest.headers as Record<string, string>)['Authorization'] =
          `Bearer ${data.access_token}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Clear session and navigate to login
      useSessionStore.getState().clearSession();
      await SecureStore.deleteItemAsync('refresh_token');
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
