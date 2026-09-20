/**
 * Root layout — Expo Router root.
 *
 * Sets up:
 * - GestureHandlerRootView (MUST be outermost for RNGH)
 * - TanStack Query client
 * - System appearance (status bar)
 * - Auth-aware redirect (checks for token on startup)
 */
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '@/state/sessionStore';
import { useColorScheme } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, setAccessToken } = useSessionStore();

  useEffect(() => {
    const checkAuth = async () => {
      // On app start, check if a refresh token exists in SecureStore
      // If so, attempt to refresh and get an access token
      let refreshToken = null;
      try {
        refreshToken = await SecureStore.getItemAsync('refresh_token');
      } catch (e) {
        console.warn('Failed to read SecureStore', e);
      }
      const inAuthGroup = segments[0] === 'auth';

      if (!refreshToken && !inAuthGroup) {
        router.replace('/auth/login');
        return;
      }

      if (refreshToken && !isAuthenticated) {
        try {
          const res = await fetch(
            `${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            setAccessToken(data.access_token);
            await SecureStore.setItemAsync('refresh_token', data.refresh_token);
            if (inAuthGroup) {
              router.replace('/(tabs)');
            }
          } else {
            await SecureStore.deleteItemAsync('refresh_token');
            if (!inAuthGroup) router.replace('/auth/login');
          }
        } catch {
          if (!inAuthGroup) router.replace('/auth/login');
        }
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
