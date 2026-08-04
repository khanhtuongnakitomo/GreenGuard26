/**
 * GreenGuard — RankingCard Component (Profile Screen)
 *
 * Figma: White card with "Ranking" label, medal icon + tier name, progress bar, trophy, points
 * Silver tier: gray medal — progress toward Gold
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
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { User } from '@/types/user.types';
import { calcProgress, formatNumber } from '@/utils/formatters';
import { useTheme } from '@/hooks/useTheme';

interface RankingCardProps {
  user: User;
  style?: ViewStyle;
}

export const RankingCard = memo<RankingCardProps>(({ user, style }) => {
  const { colors } = useTheme();
  const progress = calcProgress(user.rankingPoints, user.rankingMaxPoints);

  const tierColor = user.rankingTier === 'Gold' ? colors.rankingGold
    : user.rankingTier === 'Silver' ? colors.rankingSilver
    : colors.rankingBronze;

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.backgroundWhite, borderColor: colors.border },
      style
    ]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ranking</Text>

      <View style={styles.rankingRow}>
        {/* Left: Medal + tier name */}
        <View style={styles.tierSection}>
          <Ionicons
            name="medal-outline"
            size={26}
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
            height={8}
            color={tierColor}
            trackColor={colors.backgroundCard}
            style={styles.progressBar}
          />
        </View>

        {/* Right: Trophy */}
        <Ionicons name="trophy-outline" size={22} color={colors.rankingGold} />
      </View>

      {/* Points value right-aligned */}
      <Text style={[styles.pointsValue, { color: colors.textPrimary }]}>{formatNumber(user.rankingPoints)}</Text>
    </View>
  );
});

RankingCard.displayName = 'RankingCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.card,
    padding: Spacing.base,
    ...Shadows.card,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    width: '100%',
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  tierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 68,
  },
  tierName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  progressSection: {
    flex: 1,
  },
  progressBar: {
    borderRadius: Radius.pill,
  },
  pointsValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
  },
});
