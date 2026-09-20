/**
 * SwipeBadge — the "KEEP" / "PASS" label that appears during a drag.
 *
 * Fades and scales in proportionally with drag distance.
 * Rotated slightly to match the card tilt direction.
 */
import React from 'react';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import type { SharedValue } from 'react-native-reanimated';

interface SwipeBadgeProps {
  tintOpacity: SharedValue<number>;
  tintDirection: SharedValue<number>;
}

export const SwipeBadge = React.memo(function SwipeBadge({
  tintOpacity,
  tintDirection,
}: SwipeBadgeProps) {
  const { colors, radius, fontSize, fontWeight, spacing } = useTheme();

  const keepStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      tintDirection.value,
      [0.3, 1],
      [0, tintOpacity.value],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(opacity, [0, 1], [0.7, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { rotate: '-8deg' }],
    };
  });

  const passStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      tintDirection.value,
      [-1, -0.3],
      [tintOpacity.value, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(opacity, [0, 1], [0.7, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { rotate: '8deg' }],
    };
  });

  const badgeBase = {
    position: 'absolute' as const,
    top: spacing[5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 2.5,
  };

  return (
    <>
      {/* KEEP badge — top right */}
      <Animated.View
        style={[
          badgeBase,
          {
            right: spacing[5],
            borderColor: colors.swipeKeepText,
            backgroundColor: 'rgba(255,255,255,0.12)',
          },
          keepStyle,
        ]}
      >
        <Text
          style={{
            color: colors.swipeKeepText,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            letterSpacing: 1.5,
          }}
        >
          KEEP
        </Text>
      </Animated.View>

      {/* PASS badge — top left */}
      <Animated.View
        style={[
          badgeBase,
          {
            left: spacing[5],
            borderColor: colors.swipePassText,
            backgroundColor: 'rgba(255,255,255,0.12)',
          },
          passStyle,
        ]}
      >
        <Text
          style={{
            color: colors.swipePassText,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            letterSpacing: 1.5,
          }}
        >
          PASS
        </Text>
      </Animated.View>
    </>
  );
});
