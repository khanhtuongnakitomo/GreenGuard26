/**
 * GreenGuard — EmptyState Component
 */
import React, { memo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  style?: ViewStyle;
}

export const EmptyState = memo<EmptyStateProps>(({
  icon = 'leaf-outline',
  title,
  description,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={56} color={colors.accentSoft} />
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      )}
    </View>
  );
});

EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
