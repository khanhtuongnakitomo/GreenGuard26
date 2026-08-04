/**
 * GreenGuard — Button Component
 *
 * Variants: primary | secondary | ghost | danger
 * Supports: loading state, disabled state, animated press (scale + opacity)
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadows } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const Button = memo<ButtonProps>(({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}) => {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.88]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.965, { damping: 18, stiffness: 350, mass: 0.8 });
    pressed.value = withTiming(1, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 350, mass: 0.8 });
    pressed.value = withTiming(0, { duration: 160 });
  };

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles[`disabled_${variant}`],
        style,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={isDisabled}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? Colors.textWhite : Colors.primary}
            size="small"
          />
          <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`], styles.loadingLabel, textStyle]}>
            Loading…
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
          <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`], textStyle]}>
            {label}
          </Text>
          {rightIcon && <View style={styles.iconWrap}>{rightIcon}</View>}
        </View>
      )}
    </AnimatedTouchable>
  );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Variants ──────────────────────────────────────────────────────────────
  primary: {
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  secondary: {
    backgroundColor: Colors.backgroundWhite,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  ghost: {
    backgroundColor: Colors.transparent,
  },
  danger: {
    backgroundColor: Colors.error,
    ...Platform.select({
      ios: {
        shadowColor: Colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },

  // ── Disabled ──────────────────────────────────────────────────────────────
  disabled_primary: {
    backgroundColor: Colors.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled_secondary: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled_ghost: {
    opacity: 0.45,
  },
  disabled_danger: {
    opacity: 0.50,
    shadowOpacity: 0,
    elevation: 0,
  },

  // ── Sizes ─────────────────────────────────────────────────────────────────
  size_sm: {
    height: 38,
    paddingHorizontal: Spacing.md + 2,
  },
  size_md: {
    height: 46,
    paddingHorizontal: Spacing.lg,
  },
  size_lg: {
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl + 4,
  },

  // ── Labels ────────────────────────────────────────────────────────────────
  label: {
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.2,
  },
  loadingLabel: {
    opacity: 0.85,
  },
  label_primary: {
    color: Colors.textWhite,
  },
  label_secondary: {
    color: Colors.primary,
  },
  label_ghost: {
    color: Colors.primary,
  },
  label_danger: {
    color: Colors.textWhite,
  },
  labelSize_sm: {
    fontSize: FontSize.sm,
  },
  labelSize_md: {
    fontSize: FontSize.base,
  },
  labelSize_lg: {
    fontSize: FontSize.md,
    letterSpacing: 0.15,
  },
});
