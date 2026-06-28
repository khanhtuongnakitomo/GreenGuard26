/**
 * GreenGuard — RewardCard Component (Rewards / Get Rewarded horizontal scroll)
 *
 * Figma: Card with brand logo, reward title, "Claim Voucher" button, expiry
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  Alert,
} from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { Reward } from '@/types/reward.types';
import { formatExpiry } from '@/utils/formatters';

interface RewardCardProps {
  reward: Reward;
  onPress?: () => void;
  style?: ViewStyle;
}

export const RewardCard = memo<RewardCardProps>(({ reward, onPress, style }) => {
  const brandInitial = reward.brandName.charAt(0).toUpperCase();
  const brandColor = reward.brandColor ?? Colors.primary;

  const handleClaim = () => {
    Alert.alert('Claim Voucher', `Claim ${reward.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Claim', onPress: () => onPress?.() },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleClaim}
      activeOpacity={0.85}
    >
      {/* Brand logo */}
      <View style={[styles.brandCircle, { backgroundColor: brandColor }]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Text info */}
      <Text style={styles.title} numberOfLines={2}>{reward.title}</Text>
      <Text style={styles.expiry}>{formatExpiry(reward.expiresAt)}</Text>

      {/* Claim button */}
      <TouchableOpacity style={styles.claimButton} onPress={handleClaim}>
        <Text style={styles.claimLabel}>Claim Voucher</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

RewardCard.displayName = 'RewardCard';

const styles = StyleSheet.create({
  container: {
    width: 150,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.card,
    padding: Spacing.md,
    alignItems: 'flex-start',
    ...Shadows.card,
    marginRight: Spacing.md,
  },
  brandCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  brandInitial: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  expiry: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  claimButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  claimLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
  },
});
