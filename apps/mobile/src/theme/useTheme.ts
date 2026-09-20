/**
 * useTheme — React hook that returns the correct color token set
 * based on the system color scheme.
 *
 * Usage:
 *   const { colors, spacing, radius } = useTheme();
 */
import { useColorScheme } from 'react-native';
import { colorTokens, type Colors, type ColorScheme } from './colors';
import { spacing, radius, fontSize, fontWeight, lineHeight, shadow, animation } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  shadow: typeof shadow;
  animation: typeof animation;
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';

  return {
    scheme,
    colors: colorTokens[scheme],
    spacing,
    radius,
    fontSize,
    fontWeight,
    lineHeight,
    shadow,
    animation,
  };
}

export { spacing, radius, fontSize, fontWeight, lineHeight, shadow, animation };
export { colorTokens };
