/**
 * GreenGuard — RewardCard Component (Rewards / Get Rewarded horizontal scroll)
 *
 * Figma:
 * - White card with soft shadow
 * - Brand logo circle at top-left
 * - Reward title + expiry date
 * - "Claim Voucher" green pill button at bottom
 * - Claimed state: grayed out
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
  const isClaimed = reward.status === 'claimed';

  const handleClaim = () => {
    if (onPress) {
      onPress();
    } else {
      Alert.alert('Claim Voucher', `Claim ${reward.title}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', onPress: () => {} },
      ]);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, isClaimed && styles.containerClaimed, style]}
      onPress={handleClaim}
      activeOpacity={0.85}
      disabled={isClaimed}
    >
      {/* Brand logo circle */}
      <View style={[
        styles.brandCircle, 
        { backgroundColor: isClaimed ? Colors.borderMuted : brandColor }
      ]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Text info */}
      <Text 
        style={[styles.title, isClaimed && styles.titleClaimed]} 
        numberOfLines={2}
      >
        {reward.title}
      </Text>
      <Text style={styles.expiry}>{formatExpiry(reward.expiresAt)}</Text>

      {/* Claim button */}
      <TouchableOpacity 
        style={[styles.claimButton, isClaimed && styles.claimButtonClaimed]} 
        onPress={handleClaim}
        disabled={isClaimed}
        activeOpacity={0.8}
      >
        <Text style={[styles.claimLabel, isClaimed && styles.claimLabelClaimed]}>
          {isClaimed ? 'Claimed' : 'Claim Voucher'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

RewardCard.displayName = 'RewardCard';

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 20,
    padding: Spacing.md,
    alignItems: 'flex-start',
    ...Shadows.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginRight: Spacing.md,
  },
  containerClaimed: {
    backgroundColor: Colors.claimedBg,
    borderColor: Colors.borderMuted,
    opacity: 0.7,
  },
  brandCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
    lineHeight: 18,
    minHeight: 36,
  },
  titleClaimed: {
    color: Colors.claimedText,
  },
  expiry: {
    fontSize: FontSize.xs,
    color: Colors.textSecondaryNew,
    marginBottom: Spacing.sm,
    fontWeight: FontWeight.medium,
  },
  claimButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  claimButtonClaimed: {
    backgroundColor: Colors.borderMuted,
  },
  claimLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
  },
  claimLabelClaimed: {
    color: Colors.claimedText,
  },
});
