/**
 * Design tokens — the single source of truth for all visual constants.
 *
 * Rules enforced here:
 * - No pure #000 or #fff — surfaces use off-tones
 * - One accent color (Indigo 600) used only for primary actions and active states
 * - Soft shadows only (no hard drop shadows)
 * - Consistent 12/16/24px corner radius scale
 * - 4pt/8pt spacing grid
 */

// ─── Spacing (4pt grid) ──────────────────────────────────────────────────────
export const spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─── Type scale ──────────────────────────────────────────────────────────────
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  '2xl': 34,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
// Soft, low-opacity, large blur — never hard drop shadows
export const shadow = {
  sm: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

// ─── Animation constants ─────────────────────────────────────────────────────
export const animation = {
  // Spring config for snap-back (damped, no overshoot on return)
  springBack: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
  // Spring config for undo card return (slightly softer)
  springUndo: {
    damping: 18,
    stiffness: 250,
    mass: 1,
  },
  // Swipe gesture thresholds
  swipe: {
    distanceThresholdRatio: 0.33,  // 33% of screen width
    velocityThreshold: 800,         // px/s for flick commit
    maxRotationDeg: 14,             // degrees at full throw
    verticalDampen: 0.4,            // vertical drag multiplier
    cardDragScaleMin: 0.97,         // how much top card scales down at max drag
    stackScale: 0.94,               // scale of card N+1 in stack
    stackOffsetY: 14,               // px offset of card N+1
  },
  // Crossfade duration for media placeholder transitions
  mediaCrossfadeDuration: 300,
} as const;
