/**
 * GreenGuard — Rewards Screen (live API)
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { DonutChart } from '@/components/rewards/DonutChart';
import { RewardCard } from '@/components/rewards/RewardCard';
import { TaskProgressRow } from '@/components/rewards/TaskProgressRow';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  useImpact,
  useMilestoneTasks,
  useRewards,
  useUserSummary,
} from '@/hooks/useApi';
import { mapImpactToTotalAmount } from '@/utils/mappers';

export default function RewardsScreen() {
  const { isLargeScreen } = useResponsive();
  useUserSummary();
  const { data: rewards = [], isLoading: rewardsLoading } = useRewards();
  const { data: impact } = useImpact();
  const { data: tasks = [] } = useMilestoneTasks();

  const totalAmount = impact
    ? mapImpactToTotalAmount(impact)
    : { totalKg: 0, breakdown: [] };
  const claimable = rewards.filter((r) => r.status === 'claimable');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader rightIcon="bell" onRightIconPress={() => router.push('/wallet' as any)} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>Redeem points for campus vouchers</Text>

        <View style={styles.chartContainer}>
          <DonutChart
            totalKg={totalAmount.totalKg}
            breakdown={
              totalAmount.breakdown.length
                ? totalAmount.breakdown
                : [{ label: 'None', percentage: 100, color: Colors.borderMuted }]
            }
            size={isLargeScreen ? 250 : 200}
            strokeWidth={isLargeScreen ? 35 : 30}
          />
        </View>

        <SectionHeader
          title="Get Rewarded"
          linkLabel="Wallet ›"
          onLinkPress={() => router.push('/wallet' as any)}
        />

        {rewardsLoading ? (
          <ActivityIndicator color={Colors.primary} />
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

        <SectionHeader title="Milestones" />
        {tasks.length === 0 ? (
          <Text style={styles.empty}>No milestones yet.</Text>
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
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
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
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  subtitle: {
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  rewardScroll: {
    marginBottom: Spacing.xl,
  },
  empty: {
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
});
