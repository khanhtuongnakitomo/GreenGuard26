/**
 * GreenGuard — CollectionPointRow Component (Map Screen)
 *
 * Figma: Location pin icon + "#CocaCola1" name + address text
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
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { CollectionPoint } from '@/types/collection.types';

interface CollectionPointRowProps {
  point: CollectionPoint;
  onPress?: () => void;
  style?: ViewStyle;
}

export const CollectionPointRow = memo<CollectionPointRowProps>(({ point, onPress, style }) => {
  const isGreenPin = point.brandId === 'brand_hcmut';
  const pinColor = isGreenPin ? Colors.primary : Colors.mapPinRed;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name="location" size={28} color={pinColor} />
      <View style={styles.info}>
        <Text style={styles.name}>{point.name}</Text>
        <Text style={styles.address} numberOfLines={1}>{point.address}</Text>
      </View>
    </TouchableOpacity>
  );
});

CollectionPointRow.displayName = 'CollectionPointRow';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  address: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
