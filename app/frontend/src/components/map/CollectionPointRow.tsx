/**
 * GreenGuard — CollectionPointRow Component (Map Screen)
 *
 * Figma: Brand-colored location pin + "#CocaCola1" name + address text
 * Matches the list items below the map in the Figma design
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight } from '@/theme';
import { CollectionPoint } from '@/types/collection.types';
import { useTheme } from '@/hooks/useTheme';

interface CollectionPointRowProps {
  point: CollectionPoint;
  onPress?: () => void;
  style?: ViewStyle;
}

export const CollectionPointRow = memo<CollectionPointRowProps>(({ point, onPress, style }) => {
  const { colors } = useTheme();

  const isGreenPin = point.brandId === 'brand_hcmut';
  const pinColor = isGreenPin ? colors.primary : colors.mapPinRed;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderBottomColor: colors.divider, backgroundColor: colors.backgroundWhite },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Brand-colored pin circle */}
      <View style={[styles.pinCircle, { backgroundColor: `${pinColor}18` }]}>
        <Ionicons name="location" size={22} color={pinColor} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{point.name}</Text>
        <Text style={[styles.address, { color: colors.textMuted }]} numberOfLines={1}>{point.address}</Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

CollectionPointRow.displayName = 'CollectionPointRow';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    marginBottom: 2,
  },
  address: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
