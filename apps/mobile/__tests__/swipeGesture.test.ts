/**
 * Unit tests for swipe gesture physics helper functions.
 *
 * These are pure functions extracted from useSwipeGesture.ts
 * so they can be tested in Jest without needing Reanimated
 * (which requires native modules).
 *
 * Every gesture physics decision is covered here.
 */
import {
  computeRotation,
  computeTintOpacity,
  shouldCommitSwipe,
  getSwipeDirection,
} from '../src/hooks/useSwipeGesture';

const SCREEN_WIDTH = 390;  // iPhone 14 Pro width
const DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.33;
const VELOCITY_THRESHOLD = 800;

describe('computeRotation', () => {
  it('returns 0 when card is centered', () => {
    expect(computeRotation(0, SCREEN_WIDTH)).toBe(0);
  });

  it('returns positive rotation for rightward drag', () => {
    const rotation = computeRotation(100, SCREEN_WIDTH);
    expect(rotation).toBeGreaterThan(0);
    expect(rotation).toBeLessThanOrEqual(14); // MAX_ROTATION
  });

  it('returns negative rotation for leftward drag', () => {
    const rotation = computeRotation(-100, SCREEN_WIDTH);
    expect(rotation).toBeLessThan(0);
    expect(rotation).toBeGreaterThanOrEqual(-14);
  });

  it('rotation is proportional to drag distance', () => {
    const half = computeRotation(50, SCREEN_WIDTH);
    const full = computeRotation(100, SCREEN_WIDTH);
    expect(Math.abs(full)).toBeCloseTo(Math.abs(half) * 2, 5);
  });

  it('rotation scales with screen width', () => {
    // Wider screen → same drag distance → less rotation
    const narrow = computeRotation(100, 390);
    const wide = computeRotation(100, 780);
    expect(Math.abs(narrow)).toBeGreaterThan(Math.abs(wide));
  });
});

describe('computeTintOpacity', () => {
  it('returns 0 at center position', () => {
    expect(computeTintOpacity(0, DISTANCE_THRESHOLD)).toBe(0);
  });

  it('returns 1 at or beyond the threshold', () => {
    expect(computeTintOpacity(DISTANCE_THRESHOLD, DISTANCE_THRESHOLD)).toBe(1);
    expect(computeTintOpacity(DISTANCE_THRESHOLD * 2, DISTANCE_THRESHOLD)).toBe(1);
  });

  it('returns proportional value between 0 and 1', () => {
    const half = computeTintOpacity(DISTANCE_THRESHOLD / 2, DISTANCE_THRESHOLD);
    expect(half).toBeCloseTo(0.5, 5);
  });

  it('works for leftward (negative) drag', () => {
    const opacity = computeTintOpacity(-DISTANCE_THRESHOLD / 2, DISTANCE_THRESHOLD);
    expect(opacity).toBeCloseTo(0.5, 5);
  });
});

describe('shouldCommitSwipe', () => {
  it('commits when distance exceeds threshold', () => {
    expect(
      shouldCommitSwipe(
        DISTANCE_THRESHOLD + 1,
        0,
        DISTANCE_THRESHOLD,
        VELOCITY_THRESHOLD,
      ),
    ).toBe(true);
  });

  it('does NOT commit when under both thresholds', () => {
    expect(
      shouldCommitSwipe(
        DISTANCE_THRESHOLD * 0.5,
        200,
        DISTANCE_THRESHOLD,
        VELOCITY_THRESHOLD,
      ),
    ).toBe(false);
  });

  it('commits on fast flick even under distance threshold', () => {
    expect(
      shouldCommitSwipe(
        DISTANCE_THRESHOLD * 0.2,  // Under distance threshold
        VELOCITY_THRESHOLD + 100,   // But high velocity
        DISTANCE_THRESHOLD,
        VELOCITY_THRESHOLD,
      ),
    ).toBe(true);
  });

  it('handles leftward distance threshold correctly', () => {
    expect(
      shouldCommitSwipe(
        -(DISTANCE_THRESHOLD + 1),
        0,
        DISTANCE_THRESHOLD,
        VELOCITY_THRESHOLD,
      ),
    ).toBe(true);
  });

  it('handles leftward velocity flick correctly', () => {
    expect(
      shouldCommitSwipe(
        -50,
        -(VELOCITY_THRESHOLD + 1),
        DISTANCE_THRESHOLD,
        VELOCITY_THRESHOLD,
      ),
    ).toBe(true);
  });
});

describe('getSwipeDirection', () => {
  it('returns right for positive translation', () => {
    expect(getSwipeDirection(100, 0)).toBe('right');
  });

  it('returns left for negative translation', () => {
    expect(getSwipeDirection(-100, 0)).toBe('left');
  });

  it('uses velocity when translation is borderline', () => {
    // If translation is 0 but velocity is rightward
    expect(getSwipeDirection(0, 500)).toBe('right');
  });

  it('translationX takes precedence when unambiguous', () => {
    // Right translation, left velocity — translation wins
    expect(getSwipeDirection(200, -100)).toBe('right');
  });
});
