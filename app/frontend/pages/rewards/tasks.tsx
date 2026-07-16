/**
 * GreenGuard — Rewards by brand / partner (live)
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
import { router } from 'expo-router';
import { AppHeader } from '@/components/common/AppHeader';
import { RewardCard } from '@/components/rewards/RewardCard';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { useRewards } from '@/hooks/useApi';

export default function TasksScreen() {
  const { data: rewards = [], isLoading } = useRewards();
  const brands = useMemo(
    () => ['All', ...Array.from(new Set(rewards.map((r) => r.brandName)))],
    [rewards],
  );
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered =
    activeFilter === 'All'
      ? rewards
      : rewards.filter((r) => r.brandName === activeFilter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack rightIcon="none" />
      <Text style={styles.title}>Browse Rewards</Text>

      <View style={styles.filters}>
        {brands.map((b) => (
          <TouchableOpacity
            key={b}
            style={[styles.chip, activeFilter === b && styles.chipActive]}
            onPress={() => setActiveFilter(b)}
          >
            <Text style={[styles.chipText, activeFilter === b && styles.chipTextActive]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RewardCard
              reward={item}
              onPress={() =>
                router.push({ pathname: '/rewards/voucher-claim', params: { id: item.id } } as any)
              }
              style={{ marginBottom: Spacing.md }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.backgroundWhite,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textWhite },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
});
