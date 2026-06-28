/**
 * GreenGuard — RewardListItem Component (Home Screen Rewards section)
 *
 * Figma: Row with colored brand logo, name, and right-side points/icon
 * e.g. HCMUT (blue) — "Digital parking ticket" — "2k"
 *      CocaCola (red bg) — "Promocode" — gift icon
 *      AquaFina (blue) — "Free drink at Circle K" — gift icon
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
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { Reward } from '@/types/reward.types';

interface RewardListItemProps {
  reward: Reward;
  onPress?: () => void;
  style?: ViewStyle;
}

export const RewardListItem = memo<RewardListItemProps>(({ reward, onPress, style }) => {
  const brandInitial = reward.brandName.charAt(0).toUpperCase();
  const brandColor = reward.brandColor ?? Colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: `${brandColor}15` },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Brand logo circle */}
      <View style={[styles.brandCircle, { backgroundColor: brandColor }]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Reward info */}
      <Text style={styles.title} numberOfLines={1}>
        {reward.title}
      </Text>

      {/* Right: points value or gift icon */}
      <View style={styles.rightSection}>
        {reward.pointsValue ? (
          <Text style={styles.pointsValue}>{(reward.pointsValue / 1000).toFixed(0)}k</Text>
        ) : (
          <Ionicons name="gift-outline" size={18} color={Colors.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
});

RewardListItem.displayName = 'RewardListItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.cardSm,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
  },
  brandCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitial: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  title: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  pointsValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
});
