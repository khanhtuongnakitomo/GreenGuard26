/**
 * GreenGuard — Badge Component
 * Used for: "Green Member", status tags, filter chips, reward tags
 *
 * Variants: 'default' | 'warning' | 'error' | 'blue' | 'green'
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Spacing, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

type BadgeVariant = 'default' | 'warning' | 'error' | 'blue' | 'green';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
  variant?: BadgeVariant;
}

export const Badge = memo<BadgeProps>(({
  label,
  color,
  backgroundColor,
  icon,
  style,
  textStyle,
  size = 'md',
  variant = 'default',
}) => {
  const { colors } = useTheme();

  const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
    default: { bg: colors.backgroundCard, text: colors.primary },
    warning: { bg: colors.warningBg, text: '#92400E', border: colors.warningBorder },
    error: { bg: colors.errorLight, text: colors.error, border: '#FECACA' },
    blue: { bg: colors.infoBg, text: colors.infoText, border: colors.infoBorder },
    green: { bg: colors.greenLight, text: colors.primary, border: colors.cardBorder },
  };

  const vs = VARIANT_STYLES[variant];
  const resolvedBg = backgroundColor ?? vs.bg;
  const resolvedColor = color ?? vs.text;

  return (
    <View
      style={[
        styles.container,
        styles[`size_${size}`],
        { backgroundColor: resolvedBg },
        vs.border ? { borderWidth: 1, borderColor: vs.border } : undefined,
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.label, styles[`label_${size}`], { color: resolvedColor }, textStyle]}>
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
    borderRadius: 20,
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
