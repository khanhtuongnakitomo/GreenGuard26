/**
 * GreenGuard — Voucher Claim / Redeem Screen (live API)
 */
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { rewardService } from '@/services/reward.service';
import { useRedeemReward } from '@/hooks/useApi';
import { useUserStore } from '@/store/userStore';
import type { Reward } from '@/types/reward.types';
import { getApiErrorMessage } from '@/utils/mappers';
import { useI18n } from '@/hooks/useI18n';

export default function VoucherClaimScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [reward, setReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const redeem = useRedeemReward();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const { t } = useI18n();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const data = await rewardService.getRewardById(id);
        if (mounted) setReward(data);
      } catch (err) {
        if (Platform.OS === 'web') window.alert(getApiErrorMessage(err));
        else Alert.alert(t('common.error', 'Error'), getApiErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleRedeem = async () => {
    if (!reward) return;
    if ((user?.totalPoints ?? 0) < reward.pointsValue) {
      Alert.alert(t('rewards.notEnoughPoints', 'Not enough points'), t('rewards.needPointsToRedeem', 'You need {{points}} points to redeem this.', { points: reward.pointsValue }));
      return;
    }

    try {
      const result = await redeem.mutateAsync(reward.id);
      await refreshProfile();
      setSuccessCode(result.voucher.redeemCode);
      Alert.alert(t('rewards.redeemed', 'Redeemed!'), t('rewards.code', 'Code: {{code}}', { code: result.voucher.redeemCode }), [
        { text: t('rewards.openWallet', 'Open Wallet'), onPress: () => router.replace('/wallet' as any) },
        { text: t('common.ok', 'OK') },
      ]);
    } catch (err) {
      Alert.alert(t('rewards.redeemFailed', 'Redeem failed'), getApiErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader showBack rightIcon="none" />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!reward) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader showBack rightIcon="none" />
        <Text style={styles.missing}>{t('rewards.rewardNotFound', 'Reward not found.')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack rightIcon="none" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: reward.brandColor ?? Colors.primary }]}>
          <Text style={styles.badgeText}>{reward.brandName}</Text>
        </View>
        <Text style={styles.title}>{reward.title}</Text>
        <Text style={styles.desc}>{reward.description || 'Campus partner reward'}</Text>

        <View style={styles.metaCard}>
          <Row label={t('rewards.pointsRequired', 'Points required')} value={`${reward.pointsValue} ${t('rewards.pts', 'pts')}`} />
          <Row label={t('rewards.yourBalance', 'Your balance')} value={`${user?.totalPoints ?? 0} ${t('rewards.pts', 'pts')}`} />
          <Row label={t('rewards.expires', 'Expires')} value={reward.expiresAt} />
          {typeof reward.remainingQty === 'number' && (
            <Row label={t('rewards.remaining', 'Remaining')} value={String(reward.remainingQty)} />
          )}
          {typeof reward.valueVnd === 'number' && (
            <Row label={t('rewards.value', 'Value')} value={`${reward.valueVnd.toLocaleString()} VND`} />
          )}
        </View>

        {reward.terms.length > 0 && (
          <View style={styles.terms}>
            <Text style={styles.termsTitle}>{t('rewards.terms', 'Terms')}</Text>
            {reward.terms.map((tItem) => (
              <Text key={tItem} style={styles.termItem}>
                • {tItem}
              </Text>
            ))}
          </View>
        )}

        {successCode ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
            <Text style={styles.successText}>{t('rewards.redeemed', 'Redeemed')} · {successCode}</Text>
          </View>
        ) : (
          <Button
            label={redeem.isPending ? t('rewards.redeeming', 'Redeeming...') : t('rewards.redeemFor', 'Redeem for {{points}} pts', { points: reward.pointsValue })}
            onPress={handleRedeem}
            loading={redeem.isPending}
            disabled={reward.status !== 'claimable'}
            style={styles.btn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  content: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  missing: { textAlign: 'center', marginTop: 40, color: Colors.textMuted },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    marginBottom: Spacing.md,
  },
  badgeText: { color: Colors.textWhite, fontWeight: FontWeight.semiBold },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  desc: { color: Colors.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.xl },
  metaCard: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  rowLabel: { color: Colors.textMuted },
  rowValue: { fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  terms: { marginBottom: Spacing.xl },
  termsTitle: { fontWeight: FontWeight.semiBold, marginBottom: Spacing.sm },
  termItem: { color: Colors.textMuted, marginBottom: 4 },
  btn: { marginTop: Spacing.md },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  successText: { fontWeight: FontWeight.semiBold, color: Colors.primary },
});
