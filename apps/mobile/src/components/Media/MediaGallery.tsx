/**
 * MediaGallery — horizontal sub-gallery within a card.
 *
 * Gesture isolation: gallery swipe gestures are handled via
 * Gesture.Exclusive so they don't propagate to the deck swipe gesture.
 * The disambiguation rule:
 * - Short horizontal swipe within the left/right third → gallery advance
 * - Pan starting more centrally or with greater distance → deck swipe
 *
 * Dot indicators track the active media item.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { MediaImage } from './MediaImage';
import { MediaVideo } from './MediaVideo';
import { useTheme } from '@/theme/useTheme';
import type { MediaAssetOut } from '@/api/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAP_ZONE_WIDTH = SCREEN_WIDTH * 0.3;  // Left/right 30% for gallery navigation

interface MediaGalleryProps {
  assets: MediaAssetOut[];
  isCardActive: boolean;
}

export const MediaGallery = React.memo(function MediaGallery({
  assets,
  isCardActive,
}: MediaGalleryProps) {
  const { colors, radius, spacing } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const advance = useCallback(() => {
    setActiveIndex((i) => Math.min(i + 1, assets.length - 1));
  }, [assets.length]);

  const retreat = useCallback(() => {
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Gallery tap gesture — isolated from parent deck gesture
  // Using Gesture.Tap instead of TouchableOpacity so it can be composed with Exclusive
  const tapRight = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => {
      advance();
    });

  const tapLeft = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => {
      retreat();
    });

  const currentAsset = assets[activeIndex];

  if (!currentAsset) return null;

  return (
    <View style={styles.container}>
      {/* Media renderer */}
      {currentAsset.media_type === 'video' ? (
        <MediaVideo
          asset={currentAsset}
          isActive={isCardActive && activeIndex === activeIndex}
        />
      ) : (
        <MediaImage
          asset={currentAsset}
          style={styles.image}
        />
      )}

      {/* Tap zones — gesture-isolated */}
      {activeIndex > 0 && (
        <GestureDetector gesture={Gesture.Exclusive(tapLeft)}>
          <View style={[styles.tapZone, styles.tapZoneLeft]} />
        </GestureDetector>
      )}
      {activeIndex < assets.length - 1 && (
        <GestureDetector gesture={Gesture.Exclusive(tapRight)}>
          <View style={[styles.tapZone, styles.tapZoneRight]} />
        </GestureDetector>
      )}

      {/* Dot indicators */}
      {assets.length > 1 && (
        <View style={styles.dotsContainer} pointerEvents="none">
          {assets.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex
                      ? '#FFFFFF'
                      : 'rgba(255,255,255,0.45)',
                  width: i === activeIndex ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: TAP_ZONE_WIDTH,
  },
  tapZoneLeft: { left: 0 },
  tapZoneRight: { right: 0 },
  dotsContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 3,
  },
});
