/**
 * GreenGuard — History Screen (live point transactions)
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';
import { useHistory } from '@/hooks/useApi';
import type { PointTransaction } from '@/types/user.types';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

type HistorySection = 'all' | 'earn' | 'redeem' | 'bonus';

function mapSection(tx: PointTransaction): HistorySection {
  if (tx.type === 'redeem') return 'redeem';
  if (tx.type === 'bonus') return 'bonus';
  if (tx.type === 'earn') return 'earn';
  return 'all';
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function HistoryScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [section, setSection] = useState<HistorySection>('all');
  const { data = [], isLoading, isError, refetch } = useHistory();

  const filtered = useMemo(() => {
    if (section === 'all') return data;
    return data.filter((tx) => mapSection(tx) === section);
  }, [data, section]);

  const tabs: { value: HistorySection; label: string }[] = [
    { value: 'all', label: t('history.tabAll', 'All') },
    { value: 'earn', label: t('history.tabEarn', 'Recycling') },
    { value: 'redeem', label: t('history.tabRedeem', 'Redeem') },
    { value: 'bonus', label: t('history.tabBonus', 'Bonus') },
  ];

  const renderItem = ({ item }: { item: PointTransaction }) => {
    const { date, time } = formatWhen(item.createdAt);
    const positive = item.points >= 0;
    return (
      <View style={[styles.card, { backgroundColor: colors.backgroundWhite }]}>
        <View style={[styles.cardIcon, { backgroundColor: colors.backgroundCard }]}>
          <Ionicons
            name={positive ? 'leaf-outline' : 'gift-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.description || item.source}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
            {date} · {time} · {item.type}
          </Text>
        </View>
        <Text style={[styles.points, positive ? { color: colors.primary } : { color: colors.error }]}>
          {positive ? '+' : ''}
          {item.points}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader showBack rightIcon="none" />
      )}

      <View style={styles.tabs}>
        {tabs.map((tabItem) => (
          <TouchableOpacity
            key={tabItem.value}
            style={[styles.tab, { backgroundColor: colors.backgroundWhite }, section === tabItem.value && { backgroundColor: colors.primary }]}
            onPress={() => setSection(tabItem.value)}
          >
            <Text style={[styles.tabText, { color: colors.textMuted }, section === tabItem.value && { color: colors.textWhite }]}>
              {tabItem.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : isError ? (
        <EmptyState title={t('history.errorTitle', 'Failed to load history')} description={t('history.errorDesc', 'Tap retry below.')} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('history.emptyTitle', 'No transactions yet')} description={t('history.emptyDesc', 'Scan a QR code to earn your first points.')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {isError && (
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={[styles.retryText, { color: colors.primary }]}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  cardMeta: { fontSize: FontSize.sm, marginTop: 2 },
  points: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  retryBtn: { alignSelf: 'center', marginBottom: Spacing.xl },
  retryText: { fontWeight: FontWeight.semiBold },
});
