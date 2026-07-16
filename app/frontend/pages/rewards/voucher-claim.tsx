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

export default function VoucherClaimScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [reward, setReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const redeem = useRedeemReward();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);

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
        else Alert.alert('Error', getApiErrorMessage(err));
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
      Alert.alert('Not enough points', `You need ${reward.pointsValue} points to redeem this.`);
      return;
    }

    try {
      const result = await redeem.mutateAsync(reward.id);
      await refreshProfile();
      setSuccessCode(result.voucher.redeemCode);
      Alert.alert('Redeemed!', `Code: ${result.voucher.redeemCode}`, [
        { text: 'Open Wallet', onPress: () => router.replace('/wallet' as any) },
        { text: 'OK' },
      ]);
    } catch (err) {
      Alert.alert('Redeem failed', getApiErrorMessage(err));
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
        <Text style={styles.missing}>Reward not found.</Text>
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
          <Row label="Points required" value={`${reward.pointsValue} pts`} />
          <Row label="Your balance" value={`${user?.totalPoints ?? 0} pts`} />
          <Row label="Expires" value={reward.expiresAt} />
          {typeof reward.remainingQty === 'number' && (
            <Row label="Remaining" value={String(reward.remainingQty)} />
          )}
          {typeof reward.valueVnd === 'number' && (
            <Row label="Value" value={`${reward.valueVnd.toLocaleString()} VND`} />
          )}
        </View>

        {reward.terms.length > 0 && (
          <View style={styles.terms}>
            <Text style={styles.termsTitle}>Terms</Text>
            {reward.terms.map((t) => (
              <Text key={t} style={styles.termItem}>
                • {t}
              </Text>
            ))}
          </View>
        )}

        {successCode ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
            <Text style={styles.successText}>Redeemed · {successCode}</Text>
          </View>
        ) : (
          <Button
            label={redeem.isPending ? 'Redeeming...' : `Redeem for ${reward.pointsValue} pts`}
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
