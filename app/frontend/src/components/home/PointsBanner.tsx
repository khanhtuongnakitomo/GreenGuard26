/**
 * GreenGuard — PointsBanner Component (Home Screen)
 */
import React, { memo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useResponsive } from '@/hooks/useResponsive';
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { User, UserStats } from '@/types/user.types';
import { formatNumber } from '@/utils/formatters';
import { useTheme } from '@/hooks/useTheme';

interface PointsBannerProps {
  user: User;
  stats: UserStats;
  style?: ViewStyle;
}

/** Tier thresholds for progress bar */
const TIER_THRESHOLDS: Record<string, { next: string; target: number }> = {
  Bronze: { next: 'Silver', target: 1000 },
  Silver: { next: 'Gold', target: 3500 },
  Gold: { next: 'Platinum', target: 8000 },
  Platinum: { next: 'Platinum', target: 8000 },
};

export const PointsBanner = memo<PointsBannerProps>(({ user, stats, style }) => {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();

  const tier = user.memberTier || 'Bronze';
  const { next, target } = TIER_THRESHOLDS[tier] ?? TIER_THRESHOLDS['Silver'];
  const pts = user.totalPoints ?? 0;
  const progress = Math.min(pts / target, 1);
  const ptsToNext = Math.max(target - pts, 0);

  // Entrance animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
    translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          borderColor: colors.primaryDark,
          ...Platform.select({
            ios: {
              shadowColor: colors.primaryDark,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.38,
              shadowRadius: 14,
            },
            android: { elevation: 8 },
          }),
        },
        style,
        bannerStyle,
      ]}
    >
      {/* Decorative circle overlay */}
      <View style={styles.decorCircle} />
      <View style={styles.decorCircleSmall} />

      <View style={{ position: 'relative', zIndex: 1 }}>
        {/* Top row: info + icon */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            {/* Member badge */}
            <View style={styles.memberBadge}>
              <Ionicons name="leaf" size={11} color="#fff" />
              <Text style={styles.memberBadgeText}>GreenGuard Member</Text>
            </View>

            {/* Points label */}
            <Text style={styles.ptsLabel}>Total Green Points</Text>

            {/* Big number */}
            <View style={styles.ptsRow}>
              <Text style={styles.ptsNumber}>{formatNumber(pts)}</Text>
              <Text style={styles.ptsSuffix}>pts</Text>
            </View>

            {/* Weekly trend */}
            <View style={styles.trendRow}>
              <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.80)" />
              <Text style={styles.trendText}>
                +{formatNumber(stats.monthlyBottles * 2)} this week
              </Text>
            </View>
          </View>

          {/* Right: decorative tree box */}
          <View style={styles.treeBox}>
            <Ionicons name="leaf-outline" size={28} color="#fff" />
          </View>
        </View>

        {/* Progress bar toward next tier */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress to {next}</Text>
            <Text style={styles.progressValue}>
              {formatNumber(pts)} / {formatNumber(target)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>
          <Text style={styles.progressSubtext}>
            {ptsToNext > 0 ? `${formatNumber(ptsToNext)} pts until ${next} tier` : `${next} tier achieved! 🎉`}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

PointsBanner.displayName = 'PointsBanner';

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius['3xl'],
    borderWidth: 1.5,
    padding: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle: {
    position: 'absolute',
    top: -36,
    right: -36,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  decorCircleSmall: {
    position: 'absolute',
    bottom: -24,
    left: -24,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  leftSection: {
    flex: 1,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 20,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  ptsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  ptsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  ptsNumber: {
    fontSize: 38,
    fontWeight: FontWeight.bold,
    color: '#fff',
    lineHeight: 44,
    letterSpacing: -1,
  },
  ptsSuffix: {
    fontSize: 14,
    fontWeight: FontWeight.semiBold,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  trendText: {
    fontSize: 12,
    fontWeight: FontWeight.semiBold,
    color: 'rgba(255,255,255,0.80)',
  },
  treeBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: Spacing.md,
  },
  progressCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    padding: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: FontWeight.medium,
  },
  progressValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  progressSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: Spacing.xs,
  },
});
