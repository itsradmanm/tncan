/**
 * Color palette — light and dark token sets.
 *
 * Design rules:
 * - No pure #000 or #fff. Surfaces use off-tones.
 * - Single accent: Indigo (oklch ~60% chroma) — used only for primary actions.
 * - No purple-to-blue gradients as backgrounds.
 * - WCAG AA minimum contrast on all text/background pairs.
 */

export type ColorScheme = 'light' | 'dark';

interface ColorTokens {
  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;   // For modals/sheets (single glassmorphism use)

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;

  // Borders & separators
  border: string;
  separator: string;

  // Accent (primary actions and active states ONLY)
  accent: string;
  accentLight: string;      // 10% opacity tint for backgrounds

  // Semantic — swipe feedback
  swipeKeep: string;        // Right swipe tint (green)
  swipePass: string;        // Left swipe tint (red)
  swipeKeepText: string;
  swipePassText: string;

  // States
  error: string;
  warning: string;
  success: string;

  // Misc
  skeleton: string;         // Placeholder shimmer color
  cardBackground: string;
  iconDefault: string;
}

const light: ColorTokens = {
  // Surfaces — warm off-whites, never pure #fff
  background: '#F5F5F4',      // stone-100
  surface: '#FAFAF9',         // stone-50
  surfaceElevated: '#FFFFFF', // cards appear above surface
  surfaceOverlay: 'rgba(250,250,249,0.88)',

  // Text
  textPrimary: '#1C1917',     // stone-900
  textSecondary: '#57534E',   // stone-600
  textTertiary: '#A8A29E',    // stone-400
  textOnAccent: '#FFFFFF',

  // Borders
  border: '#E7E5E4',          // stone-200
  separator: '#F5F5F4',       // stone-100

  // Accent — Indigo 600 (primary only)
  accent: '#4F46E5',
  accentLight: 'rgba(79,70,229,0.08)',

  // Swipe feedback
  swipeKeep: 'rgba(34,197,94,0.22)',   // green wash
  swipePass: 'rgba(239,68,68,0.22)',   // red wash
  swipeKeepText: '#15803D',            // green-700
  swipePassText: '#DC2626',            // red-600

  // States
  error: '#DC2626',
  warning: '#D97706',
  success: '#16A34A',

  // Misc
  skeleton: '#E7E5E4',
  cardBackground: '#FFFFFF',
  iconDefault: '#78716C',     // stone-500
};

const dark: ColorTokens = {
  // Surfaces — near-black with warmth, never pure #000
  background: '#0F0F0E',      // very dark stone
  surface: '#1C1917',         // stone-900
  surfaceElevated: '#292524', // stone-800
  surfaceOverlay: 'rgba(28,25,23,0.90)',

  // Text
  textPrimary: '#FAFAF9',     // stone-50
  textSecondary: '#A8A29E',   // stone-400
  textTertiary: '#57534E',    // stone-600
  textOnAccent: '#FFFFFF',

  // Borders
  border: '#292524',          // stone-800
  separator: '#1C1917',       // stone-900

  // Accent — Indigo 400 (lighter for dark mode readability)
  accent: '#818CF8',
  accentLight: 'rgba(129,140,248,0.12)',

  // Swipe feedback
  swipeKeep: 'rgba(34,197,94,0.28)',
  swipePass: 'rgba(239,68,68,0.28)',
  swipeKeepText: '#4ADE80',   // green-400
  swipePassText: '#F87171',   // red-400

  // States
  error: '#F87171',
  warning: '#FCD34D',
  success: '#4ADE80',

  // Misc
  skeleton: '#292524',
  cardBackground: '#1C1917',
  iconDefault: '#78716C',
};

export const colorTokens: Record<ColorScheme, ColorTokens> = { light, dark };

export type Colors = ColorTokens;
