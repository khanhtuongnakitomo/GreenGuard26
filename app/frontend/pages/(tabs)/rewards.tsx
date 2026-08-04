import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { DonutChart } from '@/components/rewards/DonutChart';
import { RewardCard } from '@/components/rewards/RewardCard';
import { TaskProgressRow } from '@/components/rewards/TaskProgressRow';
import { Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { useResponsive } from '@/hooks/useResponsive';
import {
  useImpact,
  useMilestoneTasks,
  useRewards,
  useUserSummary,
} from '@/hooks/useApi';
import { mapImpactToTotalAmount } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

export default function RewardsScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();

  useUserSummary();
  const user = useUserStore((s) => s.user);
  const { data: rewards = [], isLoading: rewardsLoading } = useRewards();
  const { data: impact } = useImpact();
  const { data: tasks = [] } = useMilestoneTasks();

  const totalAmount = impact
    ? mapImpactToTotalAmount(impact)
    : { totalKg: 0, breakdown: [] };
  const claimable = rewards.filter((r) => r.status === 'claimable');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader rightIcon="bell" onRightIconPress={() => router.push('/wallet' as any)} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('rewards.title', 'Rewards')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondaryNew }]}>{t('rewards.subtitle', 'Redeem points for campus vouchers')}</Text>

        {/* Points / Tier summary card */}
        {user && (
          <View style={[styles.pointsCard, { backgroundColor: colors.backgroundWhite, borderColor: colors.cardBorder }]}>
            <View>
              <Text style={[styles.pointsCardLabel, { color: colors.textSecondaryNew }]}>{t('rewards.availablePoints', 'Available Points')}</Text>
              <Text style={[styles.pointsCardValue, { color: colors.textPrimary }]}>{user.totalPoints?.toLocaleString() ?? '0'}</Text>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: colors.primaryDark }]}>
              <Ionicons name="trophy-outline" size={13} color="#fff" />
              <Text style={styles.tierBadgeText}>{user.memberTier || 'Bronze'} Tier</Text>
            </View>
          </View>
        )}

        {/* Donut chart */}
        <View style={styles.chartContainer}>
          <DonutChart
            totalKg={totalAmount.totalKg}
            breakdown={
              totalAmount.breakdown.length
                ? totalAmount.breakdown
                : [{ label: t('rewards.none', 'None'), percentage: 100, color: colors.borderMuted }]
            }
            size={isLargeScreen ? 250 : 200}
            strokeWidth={isLargeScreen ? 35 : 30}
          />
        </View>

        <SectionHeader
          title={t('rewards.getRewarded', 'Get Rewarded')}
          linkLabel={t('rewards.wallet', 'Wallet ›')}
          onLinkPress={() => router.push('/wallet' as any)}
        />

        {rewardsLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rewardScroll}>
            {claimable.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                onPress={() =>
                  router.push({
                    pathname: '/rewards/voucher-claim',
                    params: { id: reward.id },
                  } as any)
                }
              />
            ))}
          </ScrollView>
        )}

        <SectionHeader title={t('rewards.milestones', 'Milestones')} />
        {tasks.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('rewards.noMilestones', 'No milestones yet.')}</Text>
        ) : (
          tasks.map((task) => (
            <TaskProgressRow
              key={task.id}
              label={task.title}
              current={task.currentPoints}
              target={task.targetPoints}
            />
          ))
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing['2xl'],
  },
  contentDesktop: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginTop: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.md,
    fontSize: FontSize.sm,
  },
  // Points / Tier card
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
    ...Shadows.card,
  },
  pointsCardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  pointsCardValue: {
    fontSize: 30,
    fontWeight: FontWeight.bold,
    lineHeight: 36,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  rewardScroll: {
    marginBottom: Spacing.xl,
  },
  empty: {
    marginBottom: Spacing.lg,
  },
});
