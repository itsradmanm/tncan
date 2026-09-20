/**
 * MediaImage — expo-image with BlurHash placeholder and progressive loading.
 *
 * Loading strategy:
 * 1. BlurHash decoded instantly (no network) — shown immediately
 * 2. Image loads from cache or network
 * 3. Cross-fade from placeholder to full image (never a hard pop-in)
 *
 * Uses expo-image for native disk+memory caching (LRU eviction,
 * shared instance across all cards in the deck).
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { useTheme } from '@/theme/useTheme';
import { animation } from '@/theme/tokens';
import type { MediaAssetOut } from '@/api/types';

interface MediaImageProps {
  asset: MediaAssetOut;
  style?: ImageStyle;
  /** If true, show the low-resolution variant first for faster reveal */
  preferLowRes?: boolean;
}

export const MediaImage = React.memo(function MediaImage({
  asset,
  style,
  preferLowRes = false,
}: MediaImageProps) {
  const { colors, radius } = useTheme();
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  if (asset.processing_status === 'failed' || hasError) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg },
        ]}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Could not load image
        </Text>
        {retryCount < 3 && (
          <TouchableOpacity
            onPress={() => {
              setHasError(false);
              setRetryCount((c) => c + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading image"
          >
            <Text style={{ color: colors.accent, marginTop: 8, fontSize: 14 }}>
              Tap to retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Select image URL — prefer low-res for initial display if requested
  const imageUrl = preferLowRes
    ? (asset.variants['360p'] ?? asset.variants['original'] ?? null)
    : (asset.variants['original'] ?? asset.variants['720p'] ?? null);

  if (!imageUrl && asset.processing_status !== 'ready') {
    // Still processing — show BlurHash placeholder
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: colors.skeleton },
          style as object,
        ]}
      >
        {asset.blurhash && (
          <Image
            source={{ blurhash: asset.blurhash }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        )}
      </View>
    );
  }

  return (
    <Image
      key={`${asset.id}-${retryCount}`}
      source={imageUrl ? { uri: imageUrl } : undefined}
      placeholder={asset.blurhash ? { blurhash: asset.blurhash } : undefined}
      contentFit="cover"
      transition={animation.mediaCrossfadeDuration}
      style={style ?? styles.fullSize}
      onError={() => setHasError(true)}
      accessibilityLabel={asset.original_filename ?? 'Image'}
      cachePolicy="memory-disk"
      recyclingKey={asset.id}
    />
  );
});

const styles = StyleSheet.create({
  fullSize: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
});
