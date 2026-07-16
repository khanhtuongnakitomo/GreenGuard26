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
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';
import { useHistory } from '@/hooks/useApi';
import type { PointTransaction } from '@/types/user.types';

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
  const [section, setSection] = useState<HistorySection>('all');
  const { data = [], isLoading, isError, refetch } = useHistory();

  const filtered = useMemo(() => {
    if (section === 'all') return data;
    return data.filter((tx) => mapSection(tx) === section);
  }, [data, section]);

  const tabs: { value: HistorySection; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'earn', label: 'Recycling' },
    { value: 'redeem', label: 'Redeem' },
    { value: 'bonus', label: 'Bonus' },
  ];

  const renderItem = ({ item }: { item: PointTransaction }) => {
    const { date, time } = formatWhen(item.createdAt);
    const positive = item.points >= 0;
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons
            name={positive ? 'leaf-outline' : 'gift-outline'}
            size={20}
            color={Colors.primary}
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.description || item.source}</Text>
          <Text style={styles.cardMeta}>
            {date} · {time} · {item.type}
          </Text>
        </View>
        <Text style={[styles.points, positive ? styles.pointsPlus : styles.pointsMinus]}>
          {positive ? '+' : ''}
          {item.points}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader showBack rightIcon="none" />
      )}

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.tab, section === t.value && styles.tabActive]}
            onPress={() => setSection(t.value)}
          >
            <Text style={[styles.tabText, section === t.value && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : isError ? (
        <EmptyState title="Failed to load history" description="Tap retry below." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No transactions yet" description="Scan a QR code to earn your first points." />
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
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
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
    backgroundColor: Colors.backgroundWhite,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.textWhite },
  list: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  cardMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  points: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  pointsPlus: { color: Colors.primary },
  pointsMinus: { color: Colors.error },
  retryBtn: { alignSelf: 'center', marginBottom: Spacing.xl },
  retryText: { color: Colors.primary, fontWeight: FontWeight.semiBold },
});
