/**
 * useSwipeGesture — Reanimated 3 worklet-based swipe gesture.
 *
 * ALL animation logic runs on the UI thread via worklets.
 * No JS bridge calls happen during active gesture frames.
 *
 * Physics:
 * - Drag: 1:1 tracking, no smoothing during active drag
 * - Rotation: (translationX / screenWidth) * MAX_ROTATION_DEG
 * - Vertical: dampened by 0.4 (reads as horizontal-primary gesture)
 * - Scale: linearly interpolates toward 0.97 at max drag distance
 * - Commit by distance: >33% of screen width
 * - Commit by velocity: >800 px/s (flick feel)
 * - On commit: velocity-matched exit, not fixed-duration
 * - On release under threshold: damped spring back (stiffness 300, damping 20)
 */
import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { Dimensions } from 'react-native';
import { animation } from '@/theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAX_ROTATION = animation.swipe.maxRotationDeg;
const DISTANCE_THRESHOLD = SCREEN_WIDTH * animation.swipe.distanceThresholdRatio;
const VELOCITY_THRESHOLD = animation.swipe.velocityThreshold;
const VERTICAL_DAMPEN = animation.swipe.verticalDampen;
const CARD_SCALE_MIN = animation.swipe.cardDragScaleMin;

export type SwipeDirection = 'left' | 'right';

interface UseSwipeGestureProps {
  onSwipe: (direction: SwipeDirection) => void;
  enabled?: boolean;
}

interface SwipeGestureResult {
  translateX: ReturnType<typeof useSharedValue<number>>;
  translateY: ReturnType<typeof useSharedValue<number>>;
  rotation: ReturnType<typeof useSharedValue<number>>;
  cardScale: ReturnType<typeof useSharedValue<number>>;
  tintOpacity: ReturnType<typeof useSharedValue<number>>;
  tintDirection: ReturnType<typeof useSharedValue<number>>;  // -1 left, +1 right
  gesture: ReturnType<typeof Gesture.Pan>;
  /**
   * Programmatically trigger the swipe animation (used by buttons and undo).
   * Shares EXACTLY the same animation path as gesture-driven swipes.
   */
  triggerSwipe: (direction: SwipeDirection) => void;
  /**
   * Animate the card back to center (used by undo).
   */
  animateBack: () => void;
}

export function useSwipeGesture({
  onSwipe,
  enabled = true,
}: UseSwipeGestureProps): SwipeGestureResult {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const tintOpacity = useSharedValue(0);
  const tintDirection = useSharedValue(0);

  // ── Worklet: commit the swipe with velocity-matched exit ────────────────
  const commitSwipe = (
    direction: SwipeDirection,
    velocityX: number,
  ) => {
    'worklet';
    const targetX = direction === 'right'
      ? SCREEN_WIDTH * 1.5
      : -SCREEN_WIDTH * 1.5;

    // Velocity-matched exit: use the actual gesture velocity as the initial
    // velocity for withSpring, so the exit feels continuous with the drag.
    const exitVelocity = Math.max(Math.abs(velocityX), VELOCITY_THRESHOLD) *
      (direction === 'right' ? 1 : -1);

    translateX.value = withSpring(
      targetX,
      { velocity: exitVelocity, damping: 15, stiffness: 180 },
      () => {
        // Notify JS thread that the card is gone
        runOnJS(onSwipe)(direction);
      },
    );
    translateY.value = withSpring(translateY.value * 2, {
      damping: 15,
      stiffness: 180,
    });
    rotation.value = withSpring(rotation.value * 1.3, {
      damping: 15,
      stiffness: 180,
    });
    tintOpacity.value = withTiming(0, { duration: 150 });
  };

  // ── Worklet: spring back to center ──────────────────────────────────────
  const snapBack = () => {
    'worklet';
    translateX.value = withSpring(0, animation.springBack);
    translateY.value = withSpring(0, animation.springBack);
    rotation.value = withSpring(0, animation.springBack);
    cardScale.value = withSpring(1, animation.springBack);
    tintOpacity.value = withTiming(0, { duration: 200 });
    tintDirection.value = 0;
  };

  // ── Pan gesture (runs entirely on UI thread) ─────────────────────────────
  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;
      translateY.value = e.translationY * VERTICAL_DAMPEN;

      // Rotation proportional to horizontal drag
      rotation.value = (e.translationX / SCREEN_WIDTH) * MAX_ROTATION;

      // Scale: subtly compress card as it's dragged far
      const dragProgress = Math.abs(e.translationX) / DISTANCE_THRESHOLD;
      cardScale.value = interpolate(
        dragProgress,
        [0, 1],
        [1, CARD_SCALE_MIN],
        Extrapolation.CLAMP,
      );

      // Tint overlay: proportional opacity based on drag distance
      tintOpacity.value = interpolate(
        Math.abs(e.translationX),
        [0, DISTANCE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP,
      );
      tintDirection.value = e.translationX > 0 ? 1 : -1;
    })
    .onEnd((e) => {
      'worklet';
      const shouldCommitByDistance =
        Math.abs(translateX.value) > DISTANCE_THRESHOLD;
      const shouldCommitByVelocity =
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

      if (shouldCommitByDistance || shouldCommitByVelocity) {
        const direction: SwipeDirection =
          translateX.value > 0 || e.velocityX > 0 ? 'right' : 'left';
        commitSwipe(direction, e.velocityX);
      } else {
        snapBack();
      }
    });

  // ── Programmatic swipe trigger (shared code path for buttons) ────────────
  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    // Set the initial position slightly off-center to make the exit natural
    const startX = direction === 'right' ? 40 : -40;
    translateX.value = startX;
    translateY.value = 0;
    rotation.value = (startX / SCREEN_WIDTH) * MAX_ROTATION;
    tintDirection.value = direction === 'right' ? 1 : -1;
    tintOpacity.value = 0.5;

    // Re-use the exact same commitSwipe worklet
    commitSwipe(direction, VELOCITY_THRESHOLD * (direction === 'right' ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animate back from off-screen (undo) ──────────────────────────────────
  const animateBack = useCallback(() => {
    // Start from off-screen and spring into center
    translateX.value = translateX.value === 0
      ? SCREEN_WIDTH * 1.2
      : translateX.value;
    translateX.value = withSpring(0, animation.springUndo);
    translateY.value = withSpring(0, animation.springUndo);
    rotation.value = withSpring(0, animation.springUndo);
    cardScale.value = withSpring(1, animation.springUndo);
    tintOpacity.value = withTiming(0, { duration: 300 });
    tintDirection.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    translateX,
    translateY,
    rotation,
    cardScale,
    tintOpacity,
    tintDirection,
    gesture,
    triggerSwipe,
    animateBack,
  };
}

// ── Pure physics helpers (UI-thread worklets AND unit-testable) ──────────────
// These are exported separately so Jest can test them without Reanimated.

/** Compute card rotation from drag position. */
export function computeRotation(translationX: number, screenWidth: number): number {
  return (translationX / screenWidth) * MAX_ROTATION;
}

/** Compute tint overlay opacity from drag distance. */
export function computeTintOpacity(translationX: number, threshold: number): number {
  const abs = Math.abs(translationX);
  if (abs >= threshold) return 1;
  if (abs <= 0) return 0;
  return abs / threshold;
}

/** Determine if a swipe should be committed given distance and velocity. */
export function shouldCommitSwipe(
  translationX: number,
  velocityX: number,
  distanceThreshold: number,
  velocityThresholdPx: number,
): boolean {
  return (
    Math.abs(translationX) > distanceThreshold ||
    Math.abs(velocityX) > velocityThresholdPx
  );
}

/** Get swipe direction from position or velocity. */
export function getSwipeDirection(
  translationX: number,
  velocityX: number,
): SwipeDirection {
  return translationX > 0 || velocityX > 0 ? 'right' : 'left';
}
