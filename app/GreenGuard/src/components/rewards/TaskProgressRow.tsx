/**
 * GreenGuard — TaskProgressRow Component (Rewards Screen Tasks section)
 *
 * Figma: Dark green filled progress bar + label + pts value
 * e.g. [████████░] 70/100 pts  Aqua Bottles
 */
import React, { memo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { calcProgress } from '@/utils/formatters';

interface TaskProgressRowProps {
  label: string;
  current: number;
  target: number;
  style?: ViewStyle;
}

export const TaskProgressRow = memo<TaskProgressRowProps>(({
  label,
  current,
  target,
  style,
}) => {
  const progress = calcProgress(current, target);

  return (
    <View style={[styles.container, style]}>
      <ProgressBar
        progress={progress}
        height={14}
        color={Colors.primary}
        trackColor={Colors.backgroundCard}
        style={styles.bar}
      />
      <View style={styles.labelRow}>
        <Text style={styles.pts}>{current}/{target} pts</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
});

TaskProgressRow.displayName = 'TaskProgressRow';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  bar: {
    marginBottom: Spacing.xs,
    borderRadius: 7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pts: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
});
