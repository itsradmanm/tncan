/**
 * TintOverlay — the directional color wash shown during a swipe drag.
 *
 * Opacity is driven by a Reanimated shared value (0 at center, 1 at threshold).
 * Direction (+1 right, -1 left) determines green vs red wash.
 * This is never a toggle — always proportional to drag distance.
 */
import React from 'react';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import type { SharedValue } from 'react-native-reanimated';

interface TintOverlayProps {
  tintOpacity: SharedValue<number>;
  tintDirection: SharedValue<number>;  // +1 = right (keep), -1 = left (pass)
}

export const TintOverlay = React.memo(function TintOverlay({
  tintOpacity,
  tintDirection,
}: TintOverlayProps) {
  const { colors } = useTheme();

  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      tintDirection.value,
      [0, 1],
      [0, tintOpacity.value],
      Extrapolation.CLAMP,
    ),
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      tintDirection.value,
      [-1, 0],
      [tintOpacity.value, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <>
      {/* Right swipe — green keep tint */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: colors.swipeKeep, borderRadius: 16 },
          keepStyle,
        ]}
        pointerEvents="none"
      />
      {/* Left swipe — red pass tint */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: colors.swipePass, borderRadius: 16 },
          passStyle,
        ]}
        pointerEvents="none"
      />
    </>
  );
});
