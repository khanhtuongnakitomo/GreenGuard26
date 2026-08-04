/**
 * GreenGuard — FilterChip Component
 * Pill-shaped toggleable filter chip.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const FilterChip = memo<FilterChipProps>(({
  label,
  active = false,
  onPress,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.backgroundWhite,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.inner}>
        <Ionicons
          name="filter-outline"
          size={12}
          color={active ? colors.textWhite : colors.textSecondary}
          style={styles.icon}
        />
        <Text
          style={[
            styles.label,
            { color: active ? colors.textWhite : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

FilterChip.displayName = 'FilterChip';

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.badge,
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
