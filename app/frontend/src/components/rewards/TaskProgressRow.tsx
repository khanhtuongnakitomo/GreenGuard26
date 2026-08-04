/**
 * GreenGuard — TaskProgressRow Component (Rewards Screen Tasks section)
 *
 * Figma: Filled progress bar + brand name label + pts progress value
 * e.g. [██████████░░░] 70/100 pts  Aqua Bottles
 */
import React, { memo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { calcProgress } from '@/utils/formatters';
import { useTheme } from '@/hooks/useTheme';

interface TaskProgressRowProps {
  label: string;
  current: number;
  target: number;
  style?: ViewStyle;
}

export const TaskProgressRow = memo<TaskProgressRowProps>((({
  label,
  current,
  target,
  style,
}) => {
  const { colors } = useTheme();
  const progress = calcProgress(current, target);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.pts, { color: colors.textMuted }]}>{current}/{target} pts</Text>
      </View>
      <ProgressBar
        progress={progress}
        height={12}
        color={colors.primary}
        trackColor={colors.backgroundCard}
        style={styles.bar}
      />
    </View>
  );
}));

TaskProgressRow.displayName = 'TaskProgressRow';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  pts: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  bar: {
    borderRadius: Radius.pill,
  },
});
