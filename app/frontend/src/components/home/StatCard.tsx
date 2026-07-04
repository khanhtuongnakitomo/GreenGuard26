/**
 * GreenGuard — StatCard Component (My Impact section, Home)
 *
 * Figma: Small white card with icon label on top, large number center, unit below
 * e.g. "34 / bottles" (Month), "286 / bottles" (Year), "1,248 / bottles" (All time)
 */
import React, { memo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { formatNumber } from '@/utils/formatters';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const StatCard = memo<StatCardProps>((({
  label,
  value,
  unit,
  icon = 'water-outline',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconRow}>
        {icon}
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{formatNumber(value)}</Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}));

StatCard.displayName = 'StatCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.cardSm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#89A08E',
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: FontSize.sm,
    color: '#89A08E',
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
});
