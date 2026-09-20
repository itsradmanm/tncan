/**
 * Card — a single swipeable card in the deck.
 *
 * Renders:
 * - Media (image, video, or gallery if multiple assets)
 * - TintOverlay (proportional drag feedback)
 * - SwipeBadge (KEEP/PASS labels)
 * - Card metadata (title, description) in a bottom sheet
 *
 * The gesture handler wraps the entire card surface.
 * All animation values are Reanimated shared values running on the UI thread.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { TintOverlay } from '@/components/ui/TintOverlay';
import { SwipeBadge } from '@/components/ui/SwipeBadge';
import { MediaImage } from '@/components/Media/MediaImage';
import { MediaVideo } from '@/components/Media/MediaVideo';
import { MediaGallery } from '@/components/Media/MediaGallery';
import { useTheme } from '@/theme/useTheme';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import type { CardOut } from '@/api/types';
import type { SharedValue } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CardProps {
  card: CardOut;
  isTop: boolean;     // Is this the topmost (interactive) card?
  stackIndex: number; // 0 = top, 1 = next, 2 = third
  /** Shared values from the top card's gesture — used to animate stack cards */
  topCardTranslateX?: SharedValue<number>;
  onSwipe: (cardId: string, direction: 'left' | 'right') => void;
  /** Ref to expose triggerSwipe for external button control */
  swipeRef?: React.MutableRefObject<{
    triggerLeft: () => void;
    triggerRight: () => void;
    animateBack: () => void;
  } | null>;
}

export const Card = React.memo(function Card({
  card,
  isTop,
  stackIndex,
  topCardTranslateX,
  onSwipe,
  swipeRef,
}: CardProps) {
  const { colors, radius, spacing, fontSize, fontWeight, shadow } = useTheme();
  const reducedMotion = useReducedMotion();

  const { translateX, translateY, rotation, cardScale, tintOpacity, tintDirection, gesture, triggerSwipe, animateBack } =
    useSwipeGesture({
      onSwipe: (direction) => onSwipe(card.id, direction),
      enabled: isTop,
    });

  // Expose controls to parent via ref
  React.useEffect(() => {
    if (swipeRef && isTop) {
      swipeRef.current = {
        triggerLeft: () => triggerSwipe('left'),
        triggerRight: () => triggerSwipe('right'),
        animateBack,
      };
    }
    return () => {
      if (swipeRef && isTop) swipeRef.current = null;
    };
  }, [isTop, swipeRef, triggerSwipe, animateBack]);

  // ── Top card animated style ────────────────────────────────────────────────
  const topCardStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      // Accessibility: replace all animations with instant crossfade
      return {};
    }
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
        { scale: cardScale.value },
      ],
    };
  });

  // ── Stack card animated style (rises as top card is dragged away) ──────────
  const { animation: anim } = useTheme();
  const stackCardStyle = useAnimatedStyle(() => {
    if (!topCardTranslateX || stackIndex === 0) return {};

    // Progress: 0 when top card is centered, 1 when it reaches commit threshold
    const THRESHOLD = SCREEN_WIDTH * anim.swipe.distanceThresholdRatio;
    const dragProgress = Math.min(
      Math.abs(topCardTranslateX.value) / THRESHOLD,
      1,
    );

    const targetScale = anim.swipe.stackScale;
    const targetOffsetY = anim.swipe.stackOffsetY;

    // Offset for 2nd vs 3rd card in stack
    const indexFactor = stackIndex === 1 ? 1 : 0.5;

    const scale =
      targetScale + (1 - targetScale) * dragProgress * indexFactor;
    const translateYVal =
      targetOffsetY - targetOffsetY * dragProgress * indexFactor;

    return {
      transform: [{ scale }, { translateY: translateYVal }],
    };
  });

  // ── Initial stack positioning (before any gesture) ────────────────────────
  const initialStackStyle = stackIndex > 0 ? {
    transform: [
      { scale: anim.swipe.stackScale + (stackIndex === 1 ? 0 : -0.03) },
      { translateY: anim.swipe.stackOffsetY * stackIndex },
    ],
  } : {};

  const hasGallery =
    card.gallery_assets && card.gallery_assets.length > 0;
  const allAssets = card.primary_asset
    ? [card.primary_asset, ...card.gallery_assets]
    : card.gallery_assets;

  const content = (
    <View style={[styles.card, { borderRadius: radius.xl }, shadow.card]}>
      {/* Media area */}
      <View style={styles.mediaContainer}>
        {hasGallery && allAssets.length > 1 ? (
          <MediaGallery assets={allAssets} isCardActive={isTop} />
        ) : card.primary_asset?.media_type === 'video' ? (
          <MediaVideo asset={card.primary_asset} isActive={isTop} />
        ) : card.primary_asset ? (
          <MediaImage
            asset={card.primary_asset}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.skeleton }]} />
        )}

        {/* Overlay tint + badges only on interactive top card */}
        {isTop && !reducedMotion && (
          <>
            <TintOverlay
              tintOpacity={tintOpacity}
              tintDirection={tintDirection}
            />
            <SwipeBadge
              tintOpacity={tintOpacity}
              tintDirection={tintDirection}
            />
          </>
        )}
      </View>

      {/* Card metadata */}
      <View
        style={[
          styles.metaContainer,
          {
            backgroundColor: colors.surface,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          },
        ]}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
          }}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {card.title}
        </Text>
        {card.description ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.sm,
              marginTop: spacing[1],
              lineHeight: fontSize.sm * 1.5,
            }}
            numberOfLines={2}
          >
            {card.description}
          </Text>
        ) : null}
      </View>
    </View>
  );

  // Only the top card gets a gesture detector
  if (isTop) {
    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.absoluteFill, topCardStyle]}
          accessible
          accessibilityLabel={`Card: ${card.title}. Swipe right to keep, left to pass.`}
          accessibilityRole="none"
          accessibilityHint="Swipe right to keep this card, or left to pass"
        >
          {content}
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <Animated.View style={[styles.absoluteFill, initialStackStyle, stackCardStyle]}>
      {content}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  mediaContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  metaContainer: {},
  placeholder: {
    flex: 1,
  },
});
