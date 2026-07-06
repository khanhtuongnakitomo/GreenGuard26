/**
 * GreenGuard — Rewards Screen
 *
 * Figma sections (top to bottom):
 * 1. AppHeader (logo + bell)
 * 2. "Total Amount" title
 * 3. Time filter tabs: 1 day | 1 month | all time
 * 4. DonutChart (15Kg waste breakdown)
 * 5. "Get Rewarded" section — horizontal scroll RewardCards
 * 6. "Tasks" section — vertical TaskProgressRows
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TimeFilterTabs } from '@/components/common/TimeFilterTabs';
import { DonutChart } from '@/components/rewards/DonutChart';
import { RewardCard } from '@/components/rewards/RewardCard';
import { TaskProgressRow } from '@/components/rewards/TaskProgressRow';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import {
  MOCK_TOTAL_AMOUNT,
  MOCK_REWARDS,
  MOCK_REWARD_TASKS_PROGRESS,
} from '@/constants/mockData';
import { TIME_FILTERS } from '@/types/common.types';
import { useResponsive } from '@/hooks/useResponsive';

export default function RewardsScreen() {
  const { isLargeScreen } = useResponsive();
  const [activeFilter, setActiveFilter] = useState<string>('1month');

  const claimableRewards = MOCK_REWARDS.filter((r) => r.status === 'claimable');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && <AppHeader rightIcon="bell" onRightIconPress={() => {}} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {isLargeScreen && (
          <View style={styles.desktopHeaderRow}>
            <AppHeader rightIcon="bell" onRightIconPress={() => {}} hideLogo />
          </View>
        )}

        <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutDesktop]}>
          <View style={[styles.column, isLargeScreen && styles.columnLeft]}>
            {/* Title */}
            <Text style={[styles.title, isLargeScreen && styles.titleDesktop]}>Total Amount</Text>

            {/* Time filter tabs */}
            <TimeFilterTabs
              tabs={TIME_FILTERS}
              activeValue={activeFilter}
              onTabPress={setActiveFilter}
              style={styles.filterTabs}
            />

            {/* Donut chart */}
            <View style={styles.chartContainer}>
              <DonutChart
                totalKg={MOCK_TOTAL_AMOUNT.totalKg}
                breakdown={MOCK_TOTAL_AMOUNT.breakdown}
                size={isLargeScreen ? 250 : 200}
                strokeWidth={isLargeScreen ? 35 : 30}
              />
            </View>
          </View>

          {/* Right Column on Desktop */}
          <View style={[styles.column, isLargeScreen && styles.columnRight]}>
            {/* Get Rewarded */}
            <View style={styles.section}>
              <SectionHeader
                title="Get Rewarded"
                linkLabel="See all"
                onLinkPress={() => router.push('/rewards/tasks')}
              />
              {isLargeScreen ? (
                <View style={styles.rewardGrid}>
                  {claimableRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onPress={() => router.push({ pathname: '/rewards/voucher-claim', params: { id: reward.id } })}
                    />
                  ))}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rewardScroll}
                >
                  {claimableRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onPress={() => router.push({ pathname: '/rewards/voucher-claim', params: { id: reward.id } })}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Tasks */}
            <View style={styles.section}>
              <SectionHeader
                title="Tasks"
                linkLabel="See all"
                onLinkPress={() => router.push('/rewards/tasks')}
              />
              <View style={isLargeScreen && styles.taskGrid}>
                {MOCK_REWARD_TASKS_PROGRESS.map((task) => (
                  <View key={task.id} style={isLargeScreen && styles.taskGridItem}>
                    <TaskProgressRow
                      label={task.label}
                      current={task.current}
                      target={task.target}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>

        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundScreen,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing['2xl'],
  },
  contentDesktop: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.xl,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  desktopHeaderRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  mainLayout: {
    flex: 1,
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    gap: Spacing['3xl'],
    marginTop: Spacing.xl,
  },
  column: {
    flex: 1,
  },
  columnLeft: {
    flex: 1,
    alignItems: 'center',
  },
  columnRight: {
    flex: 2,
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.base,
    marginTop: Spacing.sm,
  },
  titleDesktop: {
    textAlign: 'left',
    width: '100%',
  },
  filterTabs: {
    marginBottom: Spacing.xl,
    width: '100%',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    justifyContent: 'center',
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  rewardScroll: {
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rewardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  taskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'space-between',
  },
  taskGridItem: {
    width: '48%',
  },
  bottomSpacer: {
    height: Spacing.base,
  },
});
