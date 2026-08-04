/**
 * GreenGuard — Badge Component
 * Used for: "Green Member", status tags, filter chips, reward tags
 *
 * Variants: 'default' (custom color props) | 'warning' | 'error' | 'blue' | 'green'
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';

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

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  default: { bg: Colors.backgroundCard, text: Colors.primary },
  warning: { bg: Colors.warningBg, text: '#92400E', border: Colors.warningBorder },
  error: { bg: Colors.errorLight, text: Colors.error, border: '#FECACA' },
  blue: { bg: Colors.infoBg, text: Colors.infoText, border: Colors.infoBorder },
  green: { bg: Colors.greenLight, text: Colors.primary, border: Colors.cardBorder },
};

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
