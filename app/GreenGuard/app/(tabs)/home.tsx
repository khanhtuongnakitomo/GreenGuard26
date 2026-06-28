import React, { memo } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PointsBanner } from '@/components/home/PointsBanner';
import { ScanQRBanner } from '@/components/home/ScanQRBanner';
import { StatCard } from '@/components/home/StatCard';
import { RewardListItem } from '@/components/home/RewardListItem';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { useResponsive } from '@/hooks/useResponsive';
import { MOCK_HOME_REWARDS } from '@/constants/mockData';

export default function HomeScreen() {
  const { isLargeScreen } = useResponsive();
  const user = useUserStore((s) => s.user);
  const stats = useUserStore((s) => s.stats);

  if (!user || !stats) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader
          rightIcon="bell"
          onRightIconPress={() => {}}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={isLargeScreen ? styles.desktopHeaderRow : undefined}>
           <Text style={styles.greeting}>Hi, {user.name}!</Text>
           {isLargeScreen && (
             <AppHeader rightIcon="bell" onRightIconPress={() => {}} hideLogo />
           )}
        </View>

        {/* Points card */}
        <PointsBanner
          user={user}
          stats={stats}
          style={styles.pointsBanner}
        />

        {/* Scan QR banner - Mobile only */}
        {!isLargeScreen && <ScanQRBanner style={styles.scanBanner} />}

        {/* Two column layout on desktop */}
        <View style={[styles.bottomSection, isLargeScreen && styles.bottomSectionDesktop]}>
           
           <View style={[styles.column, isLargeScreen && styles.columnLeft]}>
             {/* My Impact */}
             <View style={styles.section}>
               <SectionHeader
                 title="My Impact"
                 linkLabel="View details ›"
                 onLinkPress={() => {}}
               />
               <View style={styles.statsRow}>
                 <StatCard
                   label="Month"
                   value={stats.monthlyBottles}
                   unit="bottles"
                   icon="water-outline"
                 />
                 <View style={styles.statsDivider} />
                 <StatCard
                   label="Year"
                   value={stats.yearlyBottles}
                   unit="bottles"
                   icon="archive-outline"
                 />
                 <View style={styles.statsDivider} />
                 <StatCard
                   label="All time"
                   value={stats.allTimeBottles}
                   unit="bottles"
                   icon="trending-up-outline"
                 />
               </View>
             </View>
           </View>

           <View style={[styles.column, isLargeScreen && styles.columnRight]}>
             {/* Rewards */}
             <View style={styles.section}>
               <SectionHeader
                 title="Rewards"
                 linkLabel="View all ›"
                 onLinkPress={() => router.push('/(tabs)/rewards')}
               />
               {MOCK_HOME_REWARDS.slice(0, 3).map((reward) => (
                 <RewardListItem
                   key={reward.id}
                   reward={reward}
                   onPress={() => router.push('/(tabs)/rewards')}
                 />
               ))}
             </View>
           </View>

        </View>

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
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
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  pointsBanner: {
    marginBottom: Spacing.base,
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
    flex: 1,
  },
  columnLeft: {
    flex: 2,
  },
  columnRight: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statsDivider: {
    width: Spacing.sm,
  },
  bottomSpacer: {
    height: Spacing.base,
  },
});
