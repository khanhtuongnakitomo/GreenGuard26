/**
 * GreenGuard — Impact Details Screen (live API)
 *
 * Redesigned with:
 * - Hero CO₂ banner (dark green card, centered)
 * - Horizontally scrollable mini stat chips for "This month" and "All time"
 * - Milestone rows with animated progress bars
 * - Consistent GreenGuard design language throughout
 */
import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ProgressBar } from '@/components/common/ProgressBar';
import { useResponsive } from '@/hooks/useResponsive';
import { useImpact, useMilestoneTasks } from '@/hooks/useApi';

// ─── Animated entrance wrapper ──────────────────────────────────────────────

function FadeSlideIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── StatRow card (icon + value + label in a row chip) ──────────────────────

interface StatRowItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: number;
  label: string;
  color?: string;
}

function StatRowItem({ icon, value, label, color = Colors.primary }: StatRowItemProps) {
  return (
    <View style={[statRowStyles.item]}>
      <View style={[statRowStyles.iconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={statRowStyles.value}>{value.toLocaleString()}</Text>
      <Text style={statRowStyles.label}>{label}</Text>
    </View>
  );
}

const statRowStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondaryNew,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

// ─── Milestone Row ────────────────────────────────────────────────────────────

function MilestoneRow({
  title,
  current,
  target,
  status,
}: {
  title: string;
  current: number;
  target: number;
  status: string;
}) {
  const done = status === 'completed';
  const pct = Math.min((current / target) * 100, 100);

  return (
    <View style={milestoneStyles.row}>
      {/* Left: icon */}
      <View style={[milestoneStyles.iconBox, done && milestoneStyles.iconBoxDone]}>
        <Ionicons
          name={done ? 'checkmark' : 'trophy-outline'}
          size={16}
          color={done ? Colors.textWhite : Colors.primary}
        />
      </View>

      {/* Center: info + progress */}
      <View style={{ flex: 1 }}>
        <View style={milestoneStyles.titleRow}>
          <Text style={milestoneStyles.title} numberOfLines={1}>{title}</Text>
          {done && (
            <View style={milestoneStyles.donePill}>
              <Text style={milestoneStyles.donePillText}>Done</Text>
            </View>
          )}
        </View>
        <Text style={milestoneStyles.meta}>
          {current} / {target}
        </Text>
        <View style={{ marginTop: Spacing.xs }}>
          <ProgressBar progress={pct} height={5} color={done ? Colors.primaryLight : Colors.primary} />
        </View>
      </View>

      {/* Right: percent */}
      <Text style={[milestoneStyles.pct, done && { color: Colors.primary }]}>
        {Math.round(pct)}%
      </Text>
    </View>
  );
}

const milestoneStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: `${Colors.primary}1A`,
  },
  iconBoxDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondaryNew,
    fontWeight: FontWeight.medium,
  },
  donePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSoft,
  },
  donePillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  pct: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={sectionStyles.row}>
      <View style={sectionStyles.iconWrap}>
        <Ionicons name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={sectionStyles.text}>{title}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: Colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ImpactScreen() {
  const { isLargeScreen } = useResponsive();
  const { data: impact, isLoading, isError } = useImpact();
  const { data: milestones = [] } = useMilestoneTasks();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && <AppHeader showBack rightIcon="none" />}

      <ScrollView
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ── */}
        <FadeSlideIn delay={0}>
          <Text style={styles.title}>Your Impact</Text>
          <Text style={styles.subtitle}>Your environmental contribution so far</Text>
        </FadeSlideIn>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
        ) : isError || !impact ? (
          <EmptyState title="Could not load impact" description="Try again later." />
        ) : (
          <>
            {/* ── Hero CO₂ banner ── */}
            <FadeSlideIn delay={80}>
              <View style={styles.heroBanner}>
                {/* Decorative circles */}
                <View style={styles.decoCircle1} />
                <View style={styles.decoCircle2} />

                <View style={{ zIndex: 1, alignItems: 'center' }}>
                  <View style={styles.heroIconBox}>
                    <Ionicons name="leaf" size={28} color={Colors.textWhite} />
                  </View>
                  <Text style={styles.heroCo2}>{impact.co2KgEstimate} kg</Text>
                  <Text style={styles.heroCo2Label}>Estimated CO₂ saved</Text>

                  {/* Divider */}
                  <View style={styles.heroDivider} />

                  {/* 3 quick stats in a row */}
                  <View style={styles.heroStatsRow}>
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatVal}>{impact.allTime.items}</Text>
                      <Text style={styles.heroStatLbl}>Items</Text>
                    </View>
                    <View style={styles.heroStatSep} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatVal}>{impact.allTime.bottles}</Text>
                      <Text style={styles.heroStatLbl}>Bottles</Text>
                    </View>
                    <View style={styles.heroStatSep} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatVal}>{impact.allTime.points}</Text>
                      <Text style={styles.heroStatLbl}>Points</Text>
                    </View>
                  </View>
                </View>
              </View>
            </FadeSlideIn>

            {/* ── This month ── */}
            <FadeSlideIn delay={160}>
              <SectionLabel title="This Month" icon="calendar-outline" />
              <View style={styles.statGrid}>
                <StatRowItem icon="water-outline"   value={impact.month.bottles} label="Bottles" />
                <StatRowItem icon="beer-outline"     value={impact.month.cans}    label="Cans"    />
              </View>
              <View style={[styles.statGrid, { marginTop: Spacing.sm }]}>
                <StatRowItem icon="cube-outline"    value={impact.month.cartons} label="Cartons" color={Colors.primaryLight} />
                <StatRowItem icon="star-outline"    value={impact.month.points}  label="Points"  color="#F59E0B" />
              </View>
            </FadeSlideIn>

            {/* ── All time ── */}
            <FadeSlideIn delay={240}>
              <SectionLabel title="All Time" icon="stats-chart-outline" />
              <View style={styles.statGrid}>
                <StatRowItem icon="water-outline"    value={impact.allTime.bottles} label="Bottles" />
                <StatRowItem icon="beer-outline"      value={impact.allTime.cans}    label="Cans"    />
              </View>
              <View style={[styles.statGrid, { marginTop: Spacing.sm }]}>
                <StatRowItem icon="layers-outline"  value={impact.allTime.items}   label="Items"   color={Colors.primaryLight} />
                <StatRowItem icon="star-outline"    value={impact.allTime.points}  label="Points"  color="#F59E0B" />
              </View>
            </FadeSlideIn>

            {/* ── Milestones ── */}
            {milestones.length > 0 && (
              <FadeSlideIn delay={320}>
                <SectionLabel title="Milestones" icon="trophy-outline" />
                {milestones.map((m) => (
                  <MilestoneRow
                    key={m.id}
                    title={m.title}
                    current={m.currentPoints}
                    target={m.targetPoints}
                    status={m.status}
                  />
                ))}
              </FadeSlideIn>
            )}

            <View style={{ height: Spacing['2xl'] }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Page-level styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundScreen,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  contentDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // Page title
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondaryNew,
    marginTop: 4,
    fontWeight: FontWeight.medium,
  },

  // Hero CO₂ banner
  heroBanner: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius['3xl'],
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  decoCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  decoCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroCo2: {
    fontSize: 42,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  heroCo2Label: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: FontWeight.semiBold,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  heroDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: Spacing.base,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatVal: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: FontWeight.semiBold,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroStatSep: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
