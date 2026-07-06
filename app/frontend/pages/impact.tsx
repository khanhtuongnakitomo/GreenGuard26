/**
 * GreenGuard — Impact Details Screen
 *
 * Premium dashboard showing environmental impact.
 * Linked from Home → My Impact → "View details"
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  withDelay,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { useResponsive } from '@/hooks/useResponsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterPeriod = 'week' | 'month' | 'year';

interface ImpactData {
  bottles: number;
  cans: number;
  paper: number;
  total: number;
  co2Kg: number;
  treesProtected: number;
  waterLitres: number;
  points: number;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  achieved: boolean;
  color: string;
}

interface RecentActivity {
  id: string;
  date: string;
  time: string;
  items: { type: string; qty: number }[];
  points: number;
  location: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const IMPACT_DATA: Record<FilterPeriod, ImpactData> = {
  week: {
    bottles: 12, cans: 5, paper: 8, total: 25,
    co2Kg: 0.95, treesProtected: 2, waterLitres: 280, points: 268,
  },
  month: {
    bottles: 48, cans: 22, paper: 30, total: 100,
    co2Kg: 3.81, treesProtected: 7, waterLitres: 1120, points: 1072,
  },
  year: {
    bottles: 286, cans: 140, paper: 200, total: 626,
    co2Kg: 24.0, treesProtected: 45, waterLitres: 7060, points: 6756,
  },
};

const BAR_LABELS: Record<FilterPeriod, string[]> = {
  week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  month: ['W1', 'W2', 'W3', 'W4'],
  year: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
};

const BAR_VALUES: Record<FilterPeriod, number[]> = {
  week: [8, 15, 12, 20, 18, 25, 10],
  month: [60, 80, 95, 70],
  year: [40, 80, 60, 120, 90, 110],
};

const ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', icon: '10', title: 'Recycling Starter', description: 'Recycle 10 items', achieved: true, color: Colors.primary },
  { id: 'a2', icon: '100', title: 'Green Warrior', description: 'Reach 100 items total', achieved: true, color: Colors.primaryLight },
  { id: 'a3', icon: '500', title: 'Eco Champion', description: '500 items recycled', achieved: true, color: Colors.accent },
  { id: 'a4', icon: '1K', title: 'Planet Defender', description: '1000 items recycled', achieved: false, color: Colors.textMuted },
  { id: 'a5', icon: '7d', title: '7-Day Streak', description: '7 consecutive days', achieved: true, color: Colors.warning },
  { id: 'a6', icon: '#1', title: 'Top Recycler', description: 'Rank #1 in your area', achieved: false, color: Colors.textMuted },
];

const RECENT_ACTIVITIES: RecentActivity[] = [
  {
    id: 'ra1', date: 'Today', time: '09:14 AM',
    items: [{ type: 'Plastic', qty: 3 }, { type: 'Paper', qty: 2 }],
    points: 46, location: 'HCMUT Station',
  },
  {
    id: 'ra2', date: 'Yesterday', time: '04:30 PM',
    items: [{ type: 'Cans', qty: 4 }],
    points: 32, location: 'GreenGuard Quận 1',
  },
  {
    id: 'ra3', date: '4 Jul', time: '11:00 AM',
    items: [{ type: 'Paper', qty: 2 }, { type: 'Plastic', qty: 5 }],
    points: 62, location: 'GreenGuard HCMUT',
  },
];

// ─── Animated Progress Bar ────────────────────────────────────────────────────

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  delay?: number;
}

const AnimatedProgressBar = ({ label, value, max, color, delay = 0 }: ProgressBarProps) => {
  const width = useSharedValue(0);
  const percent = Math.round((value / max) * 100);

  useEffect(() => {
    width.value = withDelay(delay, withTiming(percent, { duration: 800, easing: Easing.out(Easing.quad) }));
  }, [value, max, delay, width, percent]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { backgroundColor: color }, barStyle]} />
      </View>
    </View>
  );
};

// ─── Donut Chart ──────────────────────────────────────────────────────────────

const DONUT_SIZE = 140;
const STROKE_W = 22;
const R = (DONUT_SIZE - STROKE_W) / 2;
const CIRCUM = 2 * Math.PI * R;

interface DonutSegment { label: string; value: number; color: string }

const ImpactDonut = ({ data }: { data: ImpactData }) => {
  const segments: DonutSegment[] = [
    { label: 'Bottles', value: data.bottles, color: Colors.chartPlastic },
    { label: 'Cans', value: data.cans, color: Colors.chartMetal },
    { label: 'Paper', value: data.paper, color: Colors.chartPaper },
  ];
  const total = segments.reduce((s, i) => s + i.value, 0) || 1;
  let cumulative = 0;

  return (
    <View style={styles.donutContainer}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <G transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
          {segments.map((seg) => {
            const dasharray = (seg.value / total) * CIRCUM;
            const dashoffset = CIRCUM - cumulative * CIRCUM / total;
            const prevCumul = cumulative;
            cumulative += seg.value;
            return (
              <Circle
                key={seg.label}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={R}
                stroke={seg.color}
                strokeWidth={STROKE_W}
                strokeDasharray={`${dasharray} ${CIRCUM - dasharray}`}
                strokeDashoffset={CIRCUM - (prevCumul / total) * CIRCUM}
                fill="transparent"
              />
            );
          })}
        </G>
        <SvgText
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 - 8}
          textAnchor="middle"
          fill={Colors.textPrimary}
          fontSize="20"
          fontWeight="bold"
        >
          {total}
        </SvgText>
        <SvgText
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 + 12}
          textAnchor="middle"
          fill={Colors.textMuted}
          fontSize="10"
        >
          items
        </SvgText>
      </Svg>
      <View style={styles.donutLegend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.donutLegendRow}>
            <View style={[styles.donutDot, { backgroundColor: s.color }]} />
            <Text style={styles.donutLegendLabel}>{s.label}</Text>
            <Text style={styles.donutLegendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const BAR_CHART_H = 100;

interface BarChartProps { labels: string[]; values: number[]; color: string }

const BarChart = ({ labels, values, color }: BarChartProps) => {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChart}>
      {values.map((v, i) => {
        const barH = (v / max) * BAR_CHART_H;
        return (
          <View key={i} style={styles.barItem}>
            <Text style={styles.barTopLabel}>{v}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: barH, backgroundColor: color }]} />
            </View>
            <Text style={styles.barBottomLabel}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ImpactScreen() {
  const { isLargeScreen } = useResponsive();
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const data = IMPACT_DATA[period];
  const maxItems = Math.max(data.bottles, data.cans, data.paper);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader rightIcon="none" showBack />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Impact</Text>
          <Text style={styles.subtitle}>Your recycling makes a difference</Text>
        </View>

        {/* Period filter */}
        <View style={styles.filterRow}>
          {(['week', 'month', 'year'] as FilterPeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.filterTab, period === p && styles.filterTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.filterTabText, period === p && styles.filterTabTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Desktop: two columns */}
        <View style={isLargeScreen ? styles.desktopGrid : undefined}>

          {/* Left column */}
          <View style={isLargeScreen ? styles.desktopLeft : undefined}>

            {/* Env stats removed as requested */}

            {/* Donut chart */}
            <Text style={styles.sectionTitle}>Breakdown by Type</Text>
            <View style={styles.card}>
              <ImpactDonut data={data} />
            </View>

          </View>

          {/* Right column */}
          <View style={isLargeScreen ? styles.desktopRight : undefined}>

            {/* Progress bars */}
            <Text style={styles.sectionTitle}>Items Recycled</Text>
            <View style={styles.card}>
              <AnimatedProgressBar label="Plastic Bottles" value={data.bottles} max={maxItems || 1} color={Colors.chartPlastic} delay={0} />
              <AnimatedProgressBar label="Aluminum Cans" value={data.cans} max={maxItems || 1} color={Colors.chartMetal} delay={100} />
              <AnimatedProgressBar label="Paper" value={data.paper} max={maxItems || 1} color={Colors.chartPaper} delay={200} />
            </View>

            {/* Bar chart */}
            <Text style={styles.sectionTitle}>Activity Over Time</Text>
            <View style={styles.card}>
              <BarChart
                labels={BAR_LABELS[period]}
                values={BAR_VALUES[period]}
                color={Colors.primary}
              />
            </View>

          </View>
        </View>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((a) => (
            <View key={a.id} style={[styles.achievementBadge, !a.achieved && styles.achievementBadgeLocked]}>
              <Text style={styles.achievementIcon}>{a.icon}</Text>
              <Text style={[styles.achievementTitle, !a.achieved && styles.achievementTitleLocked]}>
                {a.title}
              </Text>
              <Text style={styles.achievementDesc}>{a.description}</Text>
              {!a.achieved && (
                <View style={styles.achievementLockOverlay}>
                  <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Recent activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {RECENT_ACTIVITIES.map((act) => (
          <View key={act.id} style={styles.activityCard}>
            <View style={styles.activityDot} />
            <View style={styles.activityLine} />
            <View style={styles.activityContent}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityDate}>{act.date} · {act.time}</Text>
                <View style={styles.activityPoints}>
                  <Text style={styles.activityPointsText}>+{act.points} pts</Text>
                </View>
              </View>
              <Text style={styles.activityLocation}>📍 {act.location}</Text>
              <View style={styles.activityItems}>
                {act.items.map((item) => (
                  <View key={item.type} style={styles.activityItemChip}>
                    <Text style={styles.activityItemText}>{item.type} ×{item.qty}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['2xl'] },
  contentDesktop: {
    paddingHorizontal: Spacing['3xl'],
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },

  titleRow: { paddingVertical: Spacing.base },
  title: { fontSize: FontSize['4xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.pill,
    padding: 3,
    marginBottom: Spacing.base,
    alignSelf: 'flex-start',
  },
  filterTab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  filterTabActive: { backgroundColor: Colors.primary },
  filterTabText: { fontSize: FontSize.base, color: Colors.textMuted, fontWeight: FontWeight.medium },
  filterTabTextActive: { color: Colors.textWhite },

  desktopGrid: { flexDirection: 'row', gap: Spacing['2xl'] },
  desktopLeft: { flex: 1 },
  desktopRight: { flex: 1 },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Progress bar
  progressRow: { marginBottom: Spacing.md },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  progressIcon: { fontSize: 16, marginRight: Spacing.xs },
  progressLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  progressValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  progressTrack: { height: 8, backgroundColor: Colors.backgroundCard, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  // Donut
  donutContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, justifyContent: 'center' },
  donutLegend: { gap: Spacing.xs },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  donutLegendValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_CHART_H + 40, gap: Spacing.xs },
  barItem: { flex: 1, alignItems: 'center' },
  barTopLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  barTrack: { width: '100%', height: BAR_CHART_H, justifyContent: 'flex-end', backgroundColor: Colors.backgroundCard, borderRadius: 4, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barBottomLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },

  // Achievements
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  achievementBadge: {
    width: '31%',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
    position: 'relative',
  },
  achievementBadgeLocked: { opacity: 0.5 },
  achievementIcon: { fontSize: 28, marginBottom: Spacing.xs },
  achievementTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  achievementTitleLocked: { color: Colors.textMuted },
  achievementDesc: { fontSize: FontSize.xs - 1, color: Colors.textMuted, textAlign: 'center' },
  achievementLockOverlay: { position: 'absolute', top: 6, right: 6 },

  // Recent activity
  activityCard: { flexDirection: 'row', marginBottom: Spacing.md, paddingLeft: Spacing.sm },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 4,
    flexShrink: 0,
  },
  activityLine: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
    alignSelf: 'stretch',
  },
  activityContent: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  activityDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  activityPoints: { backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  activityPointsText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  activityLocation: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  activityItems: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  activityItemChip: { backgroundColor: Colors.accentSoft, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  activityItemText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },

  bottomSpacer: { height: Spacing.base },
});
