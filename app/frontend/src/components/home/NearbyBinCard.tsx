/**
 * GreenGuard — NearbyBinCard Component (Home Screen)
 */
import React, { memo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

interface NearbyBin {
  id: string;
  name: string;
  distance: string;
  fillPercent: number;
}

interface NearbyBinCardProps {
  bin: NearbyBin;
  onPress?: () => void;
}

export const NearbyBinCard = memo<NearbyBinCardProps>(({ bin, onPress }) => {
  const { colors } = useTheme();

  function getFillColor(percent: number): string {
    if (percent < 50) return colors.primary;
    if (percent < 80) return colors.warning;
    return colors.error;
  }

  function getFillLabel(percent: number): string {
    if (percent < 50) return 'Low';
    if (percent < 80) return 'Medium';
    return 'High';
  }

  const fillColor = getFillColor(bin.fillPercent);
  const fillLabel = getFillLabel(bin.fillPercent);

  // Animated progress bar
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(bin.fillPercent, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [bin.fillPercent]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  // Press feedback
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.975, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(1, { duration: 80 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(0, { duration: 150 });
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.92]),
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundWhite,
          borderColor: colors.cardBorder,
          ...Platform.select({
            ios: {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.07,
              shadowRadius: 8,
            },
            android: { elevation: 3 },
          }),
        },
        cardStyle,
      ]}
      // @ts-ignore
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePressIn}
      onResponderRelease={() => { handlePressOut(); onPress?.(); }}
      onResponderTerminate={handlePressOut}
    >
      {/* Icon box */}
      <View
        style={[
          styles.iconBox,
          { backgroundColor: colors.greenLight, borderColor: `${colors.primary}1A` },
        ]}
      >
        <Ionicons name="trash-outline" size={20} color={colors.primary} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{bin.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: fillColor }]} />
        </View>
        <Text style={[styles.distance, { color: colors.textSecondaryNew }]}>{bin.distance}</Text>

        {/* Animated fill bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: fillColor },
              barStyle,
            ]}
          />
        </View>

        {/* Fill chip */}
        <View style={[styles.fillChip, { backgroundColor: `${fillColor}18`, borderColor: `${fillColor}33` }]}>
          <Text style={[styles.fillLabel, { color: fillColor }]}>
            {fillLabel} — {bin.fillPercent}%
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

NearbyBinCard.displayName = 'NearbyBinCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    flex: 1,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
    marginLeft: Spacing.xs,
  },
  distance: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    fontWeight: FontWeight.medium,
  },
  progressTrack: {
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  fillChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  fillLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.1,
  },
});
