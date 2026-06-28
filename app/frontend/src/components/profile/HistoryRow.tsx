/**
 * GreenGuard — HistoryRow Component (Profile Screen)
 *
 * Figma: White card with item list + timestamp
 * e.g. "2 Plastic Bottles 🍃 / 2 Metal Cans" — "17 Aug 2025, 9:30 pm"
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
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

  return (
    <View style={[styles.container, style]}>
      <View style={styles.itemsRow}>
        <Text style={styles.items}>{itemsText}</Text>
        <Text style={styles.leaf}> 🍃</Text>
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
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  items: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  leaf: {
    fontSize: FontSize.sm,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
