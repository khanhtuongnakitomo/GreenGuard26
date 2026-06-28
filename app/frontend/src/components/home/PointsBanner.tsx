/**
 * GreenGuard — PointsBanner Component (Home Screen)
 *
 * Figma:
 * - Rounded card with green gradient background
 * - Left: avatar + "Minh" name + "Green Member" badge + points
 * - Right: globe/earth illustration
 * - Bottom: "This month: 34 bottles · 12 cans"
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/common/Badge';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { User, UserStats } from '@/types/user.types';
import { formatNumber } from '@/utils/formatters';

interface PointsBannerProps {
  user: User;
  stats: UserStats;
  style?: ViewStyle;
}

export const PointsBanner = memo<PointsBannerProps>(({ user, stats, style }) => {
  return (
    <LinearGradient
      colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      <View style={styles.topRow}>
        {/* Left: Avatar + info */}
        <View style={styles.leftSection}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={52} color={Colors.textWhite} />
          </View>

          {/* Name + badge + points */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Badge
                label={`✦ ${user.memberTier}`}
                color={Colors.textWhite}
                backgroundColor="rgba(255,255,255,0.25)"
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

        {/* Right: Globe illustration placeholder */}
        <View style={styles.globeContainer}>
          <Text style={styles.globeEmoji}>🌍</Text>
        </View>
      </View>

      {/* Bottom: monthly stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {'This month: '}
          <Text style={styles.statsValue}>{stats.monthlyBottles} bottles</Text>
          {' · '}
          <Text style={styles.statsValue}>{stats.monthlyCans} cans</Text>
        </Text>
      </View>
    </LinearGradient>
  );
});

PointsBanner.displayName = 'PointsBanner';

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  memberBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  points: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  ptsLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
  },
  globeContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeEmoji: {
    fontSize: 52,
  },
  statsRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  statsText: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  statsValue: {
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
  },
});
