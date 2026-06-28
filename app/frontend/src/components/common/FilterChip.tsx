/**
 * GreenGuard — FilterChip Component
 * Pill-shaped toggleable filter chip.
 * e.g. "🔒 Filter: All", "🔒 Filter: CocaCola"
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
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/theme';

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
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.inner}>
        <Ionicons
          name="filter-outline"
          size={12}
          color={active ? Colors.textWhite : Colors.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
});

FilterChip.displayName = 'FilterChip';

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.badge,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.textWhite,
  },
});
