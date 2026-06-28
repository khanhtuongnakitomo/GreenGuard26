/**
 * GreenGuard — RankingCard Component (Profile Screen)
 *
 * Figma: Silver medal icon + "Silver" text + progress bar + gold trophy
 * Shows current tier and points toward next tier
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { User } from '@/types/user.types';
import { calcProgress, formatNumber } from '@/utils/formatters';

interface RankingCardProps {
  user: User;
  style?: ViewStyle;
}

export const RankingCard = memo<RankingCardProps>(({ user, style }) => {
  const progress = calcProgress(user.rankingPoints, user.rankingMaxPoints);

  const tierColor = user.rankingTier === 'Gold' ? Colors.rankingGold
    : user.rankingTier === 'Silver' ? Colors.rankingSilver
    : Colors.rankingBronze;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Ranking</Text>

      <View style={styles.rankingRow}>
        {/* Left: Medal + tier name */}
        <View style={styles.tierSection}>
          <Ionicons
            name="medal-outline"
            size={28}
            color={tierColor}
          />
          <Text style={[styles.tierName, { color: tierColor }]}>
            {user.rankingTier}
          </Text>
        </View>

        {/* Center: Progress bar */}
        <View style={styles.progressSection}>
          <ProgressBar
            progress={progress}
            height={10}
            color={tierColor}
            trackColor={Colors.backgroundCard}
          />
        </View>

        {/* Right: Trophy */}
        <Ionicons name="trophy-outline" size={24} color={Colors.rankingGold} />
      </View>

      {/* Points value right-aligned */}
      <Text style={styles.pointsValue}>{formatNumber(user.rankingPoints)}</Text>
    </View>
  );
});

RankingCard.displayName = 'RankingCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Shadows.xs,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 70,
  },
  tierName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  progressSection: {
    flex: 1,
  },
  pointsValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
});
