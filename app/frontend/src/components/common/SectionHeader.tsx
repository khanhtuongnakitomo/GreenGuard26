/**
 * GreenGuard — SectionHeader Component
 * Refined: bold title with green accent dot, animated link hover,
 * tighter vertical rhythm.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';

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
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <View style={styles.accentBar} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {linkLabel && (
        <TouchableOpacity
          onPress={onLinkPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.link}>{linkLabel}</Text>
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
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.05,
  },
  link: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
    letterSpacing: 0.1,
  },
});
