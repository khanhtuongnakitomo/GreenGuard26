/**
 * GreenGuard — HistoryRow Component (Profile Screen)
 *
 * Figma: White card with subtle shadow, item list + leaf emoji + timestamp
 * e.g. "2 Plastic Bottles 🍃 / 2 Metal Cans" — "17 Aug 2025, 9:30 pm"
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { HistoryEntry } from '@/types/user.types';
import { formatDate } from '@/utils/formatters';
import { useTheme } from '@/hooks/useTheme';

interface HistoryRowProps {
  entry: HistoryEntry;
  style?: ViewStyle;
}

export const HistoryRow = memo<HistoryRowProps>(({ entry, style }) => {
  const { colors } = useTheme();

  const itemsText = entry.items
    .map((item) => `${item.quantity} ${item.type}`)
    .join(' / ');

  const totalPoints = entry.items.reduce((sum, item) => sum + item.pointsEarned, 0);

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.backgroundWhite, borderColor: colors.border },
      style
    ]}>
      <View style={styles.header}>
        <View style={styles.iconRow}>
          <View style={[styles.leafCircle, { backgroundColor: colors.backgroundCard }]}>
            <Ionicons name="leaf-outline" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.items, { color: colors.textPrimary }]}>{itemsText}</Text>
        </View>
        <Text style={[styles.points, { color: colors.primary }]}>+{totalPoints} pts</Text>
      </View>
      <Text style={[styles.timestamp, { color: colors.textMuted }]}>{formatDate(entry.createdAt)}</Text>
    </View>
  );
});

HistoryRow.displayName = 'HistoryRow';

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.cardSm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  leafCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    flex: 1,
  },
  points: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  timestamp: {
    fontSize: FontSize.xs,
    marginLeft: 28 + Spacing.xs,
    fontWeight: FontWeight.medium,
  },
});
