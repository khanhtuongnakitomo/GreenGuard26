import React from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PointsBanner } from '@/components/home/PointsBanner';
import { ScanQRBanner } from '@/components/home/ScanQRBanner';
import { StatCard } from '@/components/home/StatCard';
import { RewardListItem } from '@/components/home/RewardListItem';
import { BottleIcon } from '@/components/icons/BottleIcon';
import { PaperIcon } from '@/components/icons/PaperIcon';
import { CalendarIcon } from '@/components/icons/CalendarIcon';
import { EmptyState } from '@/components/common/EmptyState';
import { NearbyBinCard } from '@/components/home/NearbyBinCard';
import { Spacing, FontSize, FontWeight } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useHomeRewards, useUserSummary } from '@/hooks/useApi';
import { emptyUserStats } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

const NEARBY_BINS = [
  { id: '1', name: 'B4 Recycling Hub', distance: '~80m away', fillPercent: 35 },
  { id: '2', name: 'Library Station', distance: '~150m away', fillPercent: 72 },
];

export default function HomeScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();

  const user = useUserStore((s) => s.user);
  const stats = useUserStore((s) => s.stats) ?? emptyUserStats();
  const { isLoading: summaryLoading, isError, refetch } = useUserSummary();
  const { data: homeRewards = [], isLoading: rewardsLoading } = useHomeRewards();

  if (summaryLoading && !user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
        <EmptyState
          title={isError ? t('home.couldNotLoadHome', 'Could not load home') : t('home.loadingProfile', 'Loading profile…')}
          description={
            isError
              ? t('home.checkApiReachable', 'Check that the API is reachable, then tap retry.')
              : t('home.fetchingAccount', 'Fetching your account…')
          }
        />
        {isError && (
          <Text style={[styles.retry, { color: colors.primary }]} onPress={() => refetch()}>
            {t('common.tapToRetry', 'Tap to retry')}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader
          rightIcon="bell"
          onRightIconPress={() => router.push('/wallet' as any)}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={isLargeScreen ? styles.desktopHeaderRow : undefined}>
          <View>
            <Text style={[styles.greetingSub, { color: colors.textSecondaryNew }]}>{t('home.greetingSub', 'Good morning,')}</Text>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>{t('home.greeting', `Hi, ${user.name}! 👋`, { name: user.name })}</Text>
          </View>
          {isLargeScreen && (
            <AppHeader rightIcon="bell" onRightIconPress={() => router.push('/wallet' as any)} hideLogo />
          )}
        </View>

        <PointsBanner user={user} stats={stats} style={styles.pointsBanner} />

        {!isLargeScreen && <ScanQRBanner style={styles.scanBanner} />}

        <View style={[styles.bottomSection, isLargeScreen && styles.bottomSectionDesktop]}>
          <View style={[styles.column, isLargeScreen && styles.columnLeft]}>
            <View style={styles.section}>
              <SectionHeader
                title={t('home.myImpact', 'My Impact')}
                linkLabel={t('home.viewDetails', 'View details ›')}
                onLinkPress={() => router.push('/impact' as any)}
              />
              <View style={styles.statsRow}>
                <StatCard
                  label={t('home.month', 'Month')}
                  value={stats.monthlyBottles}
                  unit={t('home.bottles', 'bottles')}
                  icon={<BottleIcon size={24} color={colors.primary} />}
                />
                <StatCard
                  label={t('home.cans', 'Cans')}
                  value={stats.monthlyCans}
                  unit={t('home.thisMonth', 'this month')}
                  icon={<PaperIcon size={24} color={colors.primary} />}
                />
                <StatCard
                  label={t('home.allTime', 'All time')}
                  value={stats.allTimeBottles}
                  unit={t('home.bottles', 'bottles')}
                  icon={<CalendarIcon size={24} color={colors.primary} />}
                />
              </View>
            </View>
          </View>

          <View style={[styles.column, isLargeScreen && styles.columnRight]}>
            <View style={styles.section}>
              <SectionHeader
                title={t('home.rewards', 'Rewards')}
                linkLabel={t('home.viewAll', 'View all ›')}
                onLinkPress={() => router.push('/(tabs)/rewards')}
              />
              {rewardsLoading && homeRewards.length === 0 ? (
                <ActivityIndicator color={colors.primary} />
              ) : homeRewards.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.noRewards', 'No rewards available yet.')}</Text>
              ) : (
                homeRewards.slice(0, 3).map((reward) => (
                  <RewardListItem
                    key={reward.id}
                    reward={reward}
                    onPress={() =>
                      router.push({
                        pathname: '/rewards/voucher-claim',
                        params: { id: reward.id },
                      } as any)
                    }
                  />
                ))
              )}
            </View>
          </View>

          {/* Nearby Bins */}
          <View style={styles.section}>
            <SectionHeader
              title={t('home.nearbyBins', 'Nearby Bins')}
              linkLabel={t('home.viewMap', 'View map ›')}
              onLinkPress={() => router.push('/(tabs)/map')}
            />
            {NEARBY_BINS.map((bin) => (
              <NearbyBinCard
                key={bin.id}
                bin={bin}
                onPress={() => router.push('/(tabs)/map')}
              />
            ))}
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
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    letterSpacing: 0.1,
  },
  greetingSub: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  pointsBanner: {
    marginBottom: Spacing.md,
  },
  scanBanner: {
    marginBottom: Spacing.xl,
  },
  bottomSection: {
    flex: 1,
  },
  bottomSectionDesktop: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
    marginTop: Spacing.xl,
  },
  column: {
  },
  columnLeft: {
    flex: 2,
  },
  columnRight: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing['2xl'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
  },
  emptyText: {
    fontSize: FontSize.base,
  },
  retry: {
    textAlign: 'center',
    fontWeight: FontWeight.semiBold,
    marginBottom: Spacing.xl,
  },
  bottomSpacer: {
    height: Spacing.base,
  },
});
