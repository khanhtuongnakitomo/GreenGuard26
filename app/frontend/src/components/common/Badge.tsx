/**
 * GreenGuard — Badge Component
 * Used for: "Green Member", status tags, filter chips
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/theme';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Badge = memo<BadgeProps>(({
  label,
  color = Colors.primary,
  backgroundColor = Colors.backgroundCard,
  icon,
  style,
  textStyle,
  size = 'md',
}) => {
  return (
    <View style={[styles.container, styles[`size_${size}`], { backgroundColor }, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.label, styles[`label_${size}`], { color }, textStyle]}>
        {label}
      </Text>
    </View>
  );
});

Badge.displayName = 'Badge';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.badge,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: Spacing.xs,
  },
  size_sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  size_md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  label: {
    fontWeight: FontWeight.semiBold,
  },
  label_sm: {
    fontSize: FontSize.xs,
  },
  label_md: {
    fontSize: FontSize.sm,
  },
});
