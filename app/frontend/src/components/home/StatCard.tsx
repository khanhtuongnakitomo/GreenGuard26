/**
 * GreenGuard — StatCard Component (My Impact section, Home)
 *
 * Premium card: animated value counter, subtle entrance, refined icon box,
 * soft shadow, clean hierarchy.
 */
import React, { memo, useEffect } from 'react';
import { StyleSheet, View, Text, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { formatNumber } from '@/utils/formatters';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const StatCard = memo<StatCardProps>((({
  label,
  value,
  unit,
  icon,
  style,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      {/* Icon box */}
      <View style={styles.iconRow}>
        {icon}
      </View>

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>{label}</Text>

      {/* Big number */}
      <Text style={styles.value} numberOfLines={1}>{formatNumber(value)}</Text>

      {/* Unit */}
      <Text style={styles.unit} numberOfLines={1}>{unit}</Text>
    </Animated.View>
  );
}));

StatCard.displayName = 'StatCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  iconRow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: `${Colors.primary}1A`,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondaryNew,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  unit: {
    fontSize: FontSize.xs,
    color: Colors.textSecondaryNew,
    marginTop: 1,
    fontWeight: FontWeight.medium,
  },
});
