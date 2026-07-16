/**
 * GreenGuard — Wallet (user vouchers)
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useWallet } from '@/hooks/useApi';
import type { UserVoucher } from '@/types/reward.types';

function rewardTitle(voucher: UserVoucher): string {
  if (voucher.rewardId && typeof voucher.rewardId === 'object' && 'name' in voucher.rewardId) {
    return voucher.rewardId.name;
  }
  return 'Voucher';
}

function partnerName(voucher: UserVoucher): string {
  if (voucher.partnerId && typeof voucher.partnerId === 'object' && 'name' in voucher.partnerId) {
    return voucher.partnerId.name;
  }
  return 'Partner';
}

export default function WalletScreen() {
  const { data = [], isLoading, isError, refetch } = useWallet();

  const renderItem = ({ item }: { item: UserVoucher }) => (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="ticket-outline" size={22} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{rewardTitle(item)}</Text>
        <Text style={styles.meta}>
          {partnerName(item)} · {item.status}
        </Text>
        <Text style={styles.code}>Code: {item.redeemCode}</Text>
        <Text style={styles.meta}>
          Expires {new Date(item.expiresAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.points}>-{item.pointsUsed}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack rightIcon="none" />
      <Text style={styles.heading}>My Wallet</Text>
      <Text style={styles.subheading}>Your redeemed vouchers</Text>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : isError ? (
        <EmptyState title="Could not load wallet" description="Check your connection." />
      ) : data.length === 0 ? (
        <EmptyState
          title="No vouchers yet"
          description="Redeem rewards to fill your wallet."
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {isError && (
        <TouchableOpacity onPress={() => refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  heading: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
  },
  subheading: {
    color: Colors.textMuted,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  meta: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  code: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
  points: { fontWeight: FontWeight.bold, color: Colors.error },
  retry: { alignSelf: 'center', marginBottom: Spacing.xl },
  retryText: { color: Colors.primary, fontWeight: FontWeight.semiBold },
});
