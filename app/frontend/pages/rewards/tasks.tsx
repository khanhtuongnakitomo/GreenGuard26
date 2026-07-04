/**
 * GreenGuard — Task List Screen (Reward Lists)
 *
 * Figma:
 * - AppHeader + bell
 * - "Reward Lists" centered title
 * - "Filter: All" chip
 * - Vertical list of RewardClaimRows
 *   - Claimable: brand logo + name + expiry + green "Claim" button
 *   - Claimed: grayed out + "CLAIMED" text
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppHeader } from '@/components/common/AppHeader';
import { FilterChip } from '@/components/common/FilterChip';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { MOCK_REWARDS } from '@/constants/mockData';
import { Reward } from '@/types/reward.types';
import { formatExpiry } from '@/utils/formatters';

const FILTERS = ['All', 'CocaCola', 'Pepsi', 'Milo', 'AquaFina'];

function RewardClaimRow({ reward }: { reward: Reward }) {
  const isClaimed = reward.status === 'claimed';
  const brandInitial = reward.brandName.charAt(0).toUpperCase();
  const brandColor = isClaimed ? Colors.borderMuted : (reward.brandColor ?? Colors.primary);

  const handleClaim = () => {
    Alert.alert('Claim Reward', `Claim "${reward.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Claim', style: 'default' },
    ]);
  };

  return (
    <View style={[styles.rowCard, isClaimed && styles.rowCardClaimed]}>
      {/* Brand logo */}
      <View style={[styles.brandCircle, { backgroundColor: brandColor }]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, isClaimed && styles.rowTitleClaimed]}>
          {reward.title}
        </Text>
        <Text style={styles.rowExpiry}>{formatExpiry(reward.expiresAt)}</Text>
      </View>

      {/* Action */}
      {isClaimed ? (
        <Text style={styles.claimedLabel}>CLAIMED</Text>
      ) : (
        <TouchableOpacity style={styles.claimButton} onPress={handleClaim}>
          <Text style={styles.claimButtonLabel}>Claim</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function TaskListScreen() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = activeFilter === 'All'
    ? MOCK_REWARDS
    : MOCK_REWARDS.filter((r) => r.brandName === activeFilter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader rightIcon="bell" onRightIconPress={() => {}} showBack />

      <View style={styles.container}>
        {/* Title */}
        <Text style={styles.title}>Reward Lists</Text>

        {/* Filter chip */}
        <View style={styles.filterRow}>
          <FilterChip
            label={`Filter: ${activeFilter}`}
            active={false}
            onPress={() => {
              const nextIndex = (FILTERS.indexOf(activeFilter) + 1) % FILTERS.length;
              setActiveFilter(FILTERS[nextIndex]);
            }}
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RewardClaimRow reward={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundScreen,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing['3xl'],
    gap: Spacing.sm,
  },
  // Row card styles
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.card,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowCardClaimed: {
    backgroundColor: Colors.backgroundScreen,
    opacity: 0.8,
  },
  brandCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandInitial: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  rowTitleClaimed: {
    color: Colors.textMuted,
  },
  rowExpiry: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  claimButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  claimButtonLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
  },
  claimedLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
});
