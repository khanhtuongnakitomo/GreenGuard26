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
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { Reward } from '@/types/reward.types';
import { formatExpiry } from '@/utils/formatters';
import { useTheme } from '@/hooks/useTheme';

interface RewardCardProps {
  reward: Reward;
  onPress?: () => void;
  style?: ViewStyle;
}

export const RewardCard = memo<RewardCardProps>(({ reward, onPress, style }) => {
  const { colors } = useTheme();

  const brandInitial = reward.brandName.charAt(0).toUpperCase();
  const brandColor = reward.brandColor ?? colors.primary;
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
      style={[
        styles.container,
        {
          backgroundColor: isClaimed ? colors.claimedBg : colors.backgroundWhite,
          borderColor: isClaimed ? colors.borderMuted : colors.cardBorder,
        },
        isClaimed && styles.containerClaimed,
        style,
      ]}
      onPress={handleClaim}
      activeOpacity={0.85}
      disabled={isClaimed}
    >
      {/* Brand logo circle */}
      <View style={[
        styles.brandCircle,
        { backgroundColor: isClaimed ? colors.borderMuted : brandColor }
      ]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Text info */}
      <Text
        style={[
          styles.title,
          { color: isClaimed ? colors.claimedText : colors.textPrimary }
        ]}
        numberOfLines={2}
      >
        {reward.title}
      </Text>
      <Text style={[styles.expiry, { color: colors.textSecondaryNew }]}>{formatExpiry(reward.expiresAt)}</Text>

      {/* Claim button */}
      <TouchableOpacity
        style={[
          styles.claimButton,
          { backgroundColor: isClaimed ? colors.borderMuted : colors.primary }
        ]}
        onPress={handleClaim}
        disabled={isClaimed}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.claimLabel,
            { color: isClaimed ? colors.claimedText : colors.textWhite }
          ]}
        >
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
    borderRadius: 20,
    padding: Spacing.md,
    alignItems: 'flex-start',
    ...Shadows.card,
    borderWidth: 1.5,
    marginRight: Spacing.md,
  },
  containerClaimed: {
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
    color: '#fff',
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    marginBottom: Spacing.xs,
    lineHeight: 18,
    minHeight: 36,
  },
  expiry: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    fontWeight: FontWeight.medium,
  },
  claimButton: {
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  claimLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
  },
});
