/**
 * GreenGuard — SectionHeader Component
 * Bold title with green accent bar + link.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Spacing, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

interface SectionHeaderProps {
  title: string;
  linkLabel?: string;
  onLinkPress?: () => void;
  style?: ViewStyle;
}

export const SectionHeader = memo<SectionHeaderProps>((({
  title,
  linkLabel,
  onLinkPress,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {linkLabel && (
        <TouchableOpacity
          onPress={onLinkPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={[styles.link, { color: colors.primary }]}>{linkLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}));

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  accentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.05,
  },
  link: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.1,
  },
});
