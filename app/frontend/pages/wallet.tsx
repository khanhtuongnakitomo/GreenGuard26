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
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useWallet } from '@/hooks/useApi';
import type { UserVoucher } from '@/types/reward.types';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

function rewardTitle(voucher: UserVoucher, fallback: string): string {
  if (voucher.rewardId && typeof voucher.rewardId === 'object' && 'name' in voucher.rewardId) {
    return voucher.rewardId.name;
  }
  return fallback;
}

function partnerName(voucher: UserVoucher, fallback: string): string {
  if (voucher.partnerId && typeof voucher.partnerId === 'object' && 'name' in voucher.partnerId) {
    return voucher.partnerId.name;
  }
  return fallback;
}

export default function WalletScreen() {
  const { data = [], isLoading, isError, refetch } = useWallet();
  const { colors } = useTheme();
  const { t } = useI18n();

  const renderItem = ({ item }: { item: UserVoucher }) => (
    <View style={[styles.card, { backgroundColor: colors.backgroundWhite }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.backgroundCard }]}>
        <Ionicons name="ticket-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{rewardTitle(item, t('wallet.voucherFallback', 'Voucher'))}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {partnerName(item, t('wallet.partnerFallback', 'Partner'))} · {item.status}
        </Text>
        <Text style={[styles.code, { color: colors.primary }]}>{t('wallet.code', 'Code:')} {item.redeemCode}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('wallet.expires', 'Expires')} {new Date(item.expiresAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.points, { color: colors.error }]}>-{item.pointsUsed}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      <AppHeader showBack rightIcon="none" />
      <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('wallet.title', 'My Wallet')}</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>{t('wallet.subtitle', 'Your redeemed vouchers')}</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : isError ? (
        <EmptyState title={t('wallet.errorTitle', 'Could not load wallet')} description={t('wallet.errorDesc', 'Check your connection.')} />
      ) : data.length === 0 ? (
        <EmptyState
          title={t('wallet.emptyTitle', 'No vouchers yet')}
          description={t('wallet.emptyDesc', 'Redeem rewards to fill your wallet.')}
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
          <Text style={[styles.retryText, { color: colors.primary }]}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heading: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.base,
  },
  subheading: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: FontWeight.semiBold },
  meta: { fontSize: FontSize.sm, marginTop: 2 },
  code: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
  points: { fontWeight: FontWeight.bold },
  retry: { alignSelf: 'center', marginBottom: Spacing.xl },
  retryText: { fontWeight: FontWeight.semiBold },
});
