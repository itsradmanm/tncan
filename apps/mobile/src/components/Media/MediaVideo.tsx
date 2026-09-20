/**
 * MediaVideo — expo-av video player for cards.
 *
 * Behavior:
 * - Autoplays muted and loops when the card is on top of the stack (isActive)
 * - Pauses immediately when isActive becomes false
 * - Tap toggles audio (muted → unmuted)
 * - Shows poster frame (BlurHash or poster image) before first play
 * - Explicit error state with retry
 * - Respects HLS adaptive bitrate via the 360p manifest URL (lowest bitrate first)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/useTheme';
import type { MediaAssetOut } from '@/api/types';

interface MediaVideoProps {
  asset: MediaAssetOut;
  isActive: boolean;  // True when this card is on top of the stack
}

export const MediaVideo = React.memo(function MediaVideo({
  asset,
  isActive,
}: MediaVideoProps) {
  const { colors, radius } = useTheme();
  const videoRef = useRef<Video>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Select video source — lowest bitrate HLS rendition for adaptive startup
  const videoUri =
    asset.variants['360p'] ??
    asset.variants['720p'] ??
    asset.variants['1080p'] ??
    null;

  const posterUri = asset.variants['poster'] ?? null;

  // ── Active/inactive management ─────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !isLoaded) return;

    if (isActive) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive, isLoaded]);

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setHasError(true);
      return;
    }
    if (!isLoaded) setIsLoaded(true);
  }, [isLoaded]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  if (hasError || !videoUri) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
        {posterUri && (
          <Image
            source={{ uri: posterUri }}
            placeholder={asset.blurhash ? { blurhash: asset.blurhash } : undefined}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        )}
        <View style={styles.errorOverlay}>
          <Text style={{ color: '#fff', fontSize: 14 }}>
            Could not load video
          </Text>
          {retryCount < 3 && (
            <TouchableOpacity
              onPress={handleRetry}
              style={{ marginTop: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading video"
            >
              <Text style={{ color: colors.accent, fontSize: 14 }}>
                Tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleToggleMute}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={isMuted ? 'Tap to unmute video' : 'Tap to mute video'}
      accessibilityHint="Toggles audio for this video"
    >
      {/* Poster/blur placeholder shown before video loads */}
      {!isLoaded && (
        <Image
          source={posterUri ? { uri: posterUri } : undefined}
          placeholder={asset.blurhash ? { blurhash: asset.blurhash } : undefined}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      )}

      <Video
        key={`video-${asset.id}-${retryCount}`}
        ref={videoRef}
        source={{ uri: videoUri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted={isMuted}
        shouldPlay={isActive}
        onPlaybackStatusUpdate={handlePlaybackStatus}
        useNativeControls={false}
        progressUpdateIntervalMillis={500}
      />

      {/* Mute indicator */}
      <View style={styles.muteIndicator} pointerEvents="none">
        <Text style={styles.muteIcon}>
          {isMuted ? '🔇' : '🔊'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIcon: {
    fontSize: 16,
  },
});
