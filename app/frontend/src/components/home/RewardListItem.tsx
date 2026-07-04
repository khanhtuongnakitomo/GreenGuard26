/**
 * GreenGuard — RewardListItem Component (Home Screen Rewards section)
 *
 * Figma: Row with colored brand logo circle, reward name, right-side points/gift icon
 * e.g. HCMUT (blue circle) — "Digital parking ticket" — "2k"
 *      CocaCola (red circle) — "Promocode" — gift icon
 *      AquaFina (blue circle) — "Free drink at Circle K" — gift icon
 * Background tinted with brand color at very low opacity
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
        { backgroundColor: `${brandColor}12` },
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
          <Text style={[styles.pointsValue, { color: brandColor }]}>
            {(reward.pointsValue / 1000).toFixed(0)}k
          </Text>
        ) : (
          <Ionicons name="gift-outline" size={18} color={brandColor} />
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  brandCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  pointsValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
});
