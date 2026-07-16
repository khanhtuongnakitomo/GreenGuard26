/**
 * GreenGuard — Impact Details Screen (live API)
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';
import { useImpact, useMilestoneTasks } from '@/hooks/useApi';

export default function ImpactScreen() {
  const { isLargeScreen } = useResponsive();
  const { data: impact, isLoading, isError } = useImpact();
  const { data: milestones = [] } = useMilestoneTasks();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && <AppHeader showBack rightIcon="none" />}

      <ScrollView contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}>
        <Text style={styles.title}>Your Impact</Text>
        <Text style={styles.subtitle}>Environmental stats from your recycling activity</Text>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : isError || !impact ? (
          <EmptyState title="Could not load impact" description="Try again later." />
        ) : (
          <>
            <View style={styles.heroCard}>
              <Ionicons name="leaf" size={32} color={Colors.primary} />
              <Text style={styles.heroValue}>{impact.co2KgEstimate} kg</Text>
              <Text style={styles.heroLabel}>Estimated CO₂ saved</Text>
            </View>

            <Text style={styles.sectionTitle}>This month</Text>
            <View style={styles.grid}>
              <StatBox label="Bottles" value={impact.month.bottles} />
              <StatBox label="Cans" value={impact.month.cans} />
              <StatBox label="Cartons" value={impact.month.cartons} />
              <StatBox label="Points" value={impact.month.points} />
            </View>

            <Text style={styles.sectionTitle}>All time</Text>
            <View style={styles.grid}>
              <StatBox label="Bottles" value={impact.allTime.bottles} />
              <StatBox label="Cans" value={impact.allTime.cans} />
              <StatBox label="Items" value={impact.allTime.items} />
              <StatBox label="Points" value={impact.allTime.points} />
            </View>

            {milestones.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Milestones</Text>
                {milestones.map((m) => (
                  <View key={m.id} style={styles.milestoneRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.milestoneTitle}>{m.title}</Text>
                      <Text style={styles.milestoneMeta}>
                        {m.currentPoints}/{m.targetPoints} · {m.status === 'completed' ? 'Done' : 'In progress'}
                      </Text>
                    </View>
                    <Ionicons
                      name={m.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={m.status === 'completed' ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  content: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  contentDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
  },
  heroCard: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroValue: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  heroLabel: { color: Colors.textMuted, marginTop: Spacing.xs },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statBox: {
    width: '48%',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  statValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statLabel: { color: Colors.textMuted, marginTop: 2 },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  milestoneTitle: { fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  milestoneMeta: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
});
