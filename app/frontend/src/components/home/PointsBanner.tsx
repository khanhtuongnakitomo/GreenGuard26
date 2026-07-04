/**
 * GreenGuard — PointsBanner Component (Home Screen)
 *
 * Figma:
 * - Rounded card with deep green gradient background
 * - Left: avatar circle + name + "Green Member" badge + large points number
 * - Right: Earth illustration
 * - Bottom separator: "This month: 34 bottles · 12 cans"
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsive } from '@/hooks/useResponsive';
import { Badge } from '@/components/common/Badge';
import { ProfileEarthIcon } from '@/components/icons/ProfileEarthIcon';
import { AvatarIcon } from '@/components/icons/AvatarIcon';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { User, UserStats } from '@/types/user.types';
import { formatNumber } from '@/utils/formatters';

interface PointsBannerProps {
  user: User;
  stats: UserStats;
  style?: ViewStyle;
}

export const PointsBanner = memo<PointsBannerProps>(({ user, stats, style }) => {
  const { isLargeScreen } = useResponsive();

  return (
    <LinearGradient
      colors={['#EAF3E1', '#E0ECD3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style, { overflow: 'hidden' }]}
    >
      <View style={styles.topRow}>
        {/* Left: Avatar + info */}
        <View style={styles.leftSection}>
          {/* Avatar circle */}
          <View style={styles.avatarContainer}>
            <AvatarIcon size={52} />
          </View>

          {/* Name + badge + points */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Badge
                label={`🌱 ${user.memberTier}`}
                color={Colors.primary}
                backgroundColor={Colors.backgroundScreen}
                size="sm"
                style={styles.memberBadge}
              />
            </View>
            <Text style={styles.points}>
              {formatNumber(user.totalPoints)}{' '}
              <Text style={styles.ptsLabel}>pts</Text>
            </Text>
          </View>
        </View>

        {/* Right: Earth illustration */}
        <View style={[styles.earthContainer, !isLargeScreen && styles.earthContainerMobile]}>
          <ProfileEarthIcon size={isLargeScreen ? 140 : 180} />
        </View>
      </View>

      {/* Bottom: monthly stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {'This month: '}
          <Text style={styles.statsValue}>{stats.monthlyBottles} bottles</Text>
          {'  ·  '}
          <Text style={styles.statsValue}>{stats.monthlyCans} cans</Text>
        </Text>
      </View>
    </LinearGradient>
  );
});

PointsBanner.displayName = 'PointsBanner';

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    overflow: 'hidden', // PREVENT IMAGE BLEEDING
    ...Shadows.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#0D3E1A',
    letterSpacing: 0.2,
  },
  memberBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  points: {
    fontSize: FontSize['5xl'],
    fontWeight: FontWeight.bold,
    color: '#0D3E1A',
    lineHeight: 48,
    letterSpacing: -1,
  },
  ptsLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#398C49',
  },
  earthContainer: {
    width: 140,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing.sm,
    zIndex: 1,
  },
  earthContainerMobile: {
    position: 'absolute',
    right: -20,
    bottom: -10,
    width: 180,
    height: 90,
  },
  statsRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: Spacing.sm,
    marginTop: 2,
    zIndex: 2,
  },
  statsText: {
    fontSize: FontSize.sm,
    color: '#398C49',
    fontWeight: FontWeight.regular,
  },
  statsValue: {
    fontWeight: FontWeight.bold,
    color: '#398C49',
  },
});
