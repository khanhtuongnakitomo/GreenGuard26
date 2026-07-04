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
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { HistoryEntry } from '@/types/user.types';
import { formatDate } from '@/utils/formatters';

interface HistoryRowProps {
  entry: HistoryEntry;
  style?: ViewStyle;
}

export const HistoryRow = memo<HistoryRowProps>(({ entry, style }) => {
  const itemsText = entry.items
    .map((item) => `${item.quantity} ${item.type}`)
    .join(' / ');

  const totalPoints = entry.items.reduce((sum, item) => sum + item.pointsEarned, 0);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.iconRow}>
          <View style={styles.leafCircle}>
            <Ionicons name="leaf-outline" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.items}>{itemsText}</Text>
        </View>
        <Text style={styles.points}>+{totalPoints} pts</Text>
      </View>
      <Text style={styles.timestamp}>{formatDate(entry.createdAt)}</Text>
    </View>
  );
});

HistoryRow.displayName = 'HistoryRow';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.cardSm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  points: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 28 + Spacing.xs,
    fontWeight: FontWeight.medium,
  },
});
