/**
 * GreenGuard — StatCard Component (My Impact section, Home)
 *
 * Figma: Small card with icon, large number, and label
 * e.g. "34 / bottles" (Month), "286 / bottles" (Year)
 */
import React, { memo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { formatNumber } from '@/utils/formatters';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export const StatCard = memo<StatCardProps>(({
  label,
  value,
  unit,
  icon = 'water-outline',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconRow}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{formatNumber(value)}</Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
});

StatCard.displayName = 'StatCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.cardSm,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.xs,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
  value: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  unit: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
