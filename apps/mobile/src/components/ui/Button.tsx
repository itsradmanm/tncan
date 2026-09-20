/**
 * Button — production-quality button with haptic feedback.
 *
 * Variants: primary (accent), secondary (outlined), ghost (text only).
 * All buttons use the consistent accent color for primary actions.
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  label: string;
}

export const Button = React.memo(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  style,
  label,
  disabled,
  ...props
}: ButtonProps) {
  const { colors, radius, fontSize, fontWeight, spacing } = useTheme();

  const sizeStyles = {
    sm: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      fontSize: fontSize.sm,
      borderRadius: radius.sm,
    },
    md: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      fontSize: fontSize.md,
      borderRadius: radius.md,
    },
    lg: {
      paddingHorizontal: spacing[6],
      paddingVertical: spacing[4],
      fontSize: fontSize.lg,
      borderRadius: radius.lg,
    },
  }[size];

  const variantStyles = {
    primary: {
      backgroundColor: colors.accent,
      borderWidth: 0,
      textColor: colors.textOnAccent,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
      textColor: colors.textPrimary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      textColor: colors.accent,
    },
    danger: {
      backgroundColor: colors.error,
      borderWidth: 0,
      textColor: '#FFFFFF',
    },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        {
          backgroundColor: variantStyles.backgroundColor,
          borderWidth: variantStyles.borderWidth,
          borderColor:
            variant === 'secondary' ? colors.border : undefined,
          borderRadius: sizeStyles.borderRadius,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: isDisabled ? 0.5 : 1,
          gap: spacing[2],
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.textColor}
        />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text
            style={{
              color: variantStyles.textColor,
              fontSize: sizeStyles.fontSize,
              fontWeight: fontWeight.semibold,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
});
