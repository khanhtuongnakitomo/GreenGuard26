/**
 * GreenGuard — History Screen
 *
 * Sections: Recycling / Point / Voucher / Mission
 * Timeline layout with filter tabs, search, and pagination.
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';

// ─── Types ─────────────────────────────────────────────────────────────────────

type HistorySection = 'recycling' | 'points' | 'vouchers' | 'missions';
type TimePeriod = 'today' | 'week' | 'month' | 'year';

type HistoryStatus = 'completed' | 'pending' | 'failed' | 'expired' | 'used';

interface HistoryEntry {
  id: string;
  date: string;          // "2026-07-04"
  time: string;          // "09:14 AM"
  section: HistorySection;
  status: HistoryStatus;
  title: string;
  subtitle?: string;
  location?: string;
  points?: number;
  transactionId: string;
  voucherName?: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_HISTORY: HistoryEntry[] = [
  // Recycling
  {
    id: 'h001', date: '2026-07-06', time: '09:14 AM', section: 'recycling',
    status: 'completed', title: 'Recycling Session', subtitle: 'Plastic ×3, Paper ×2',
    location: 'HCMUT Station', points: 46, transactionId: 'TXN-A84F21',
  },
  {
    id: 'h002', date: '2026-07-05', time: '04:30 PM', section: 'recycling',
    status: 'completed', title: 'Recycling Session', subtitle: 'Cans ×4',
    location: 'GreenGuard Quận 1', points: 32, transactionId: 'TXN-B12C90',
  },
  {
    id: 'h003', date: '2026-07-04', time: '11:00 AM', section: 'recycling',
    status: 'completed', title: 'Recycling Session', subtitle: 'Glass ×2, Plastic ×5',
    location: 'GreenGuard HCMUT', points: 62, transactionId: 'TXN-C55D11',
  },
  {
    id: 'h004', date: '2026-07-01', time: '08:00 AM', section: 'recycling',
    status: 'completed', title: 'Recycling Session', subtitle: 'Paper ×6',
    location: 'GreenGuard Quận 10', points: 36, transactionId: 'TXN-D77E22',
  },
  {
    id: 'h005', date: '2026-06-28', time: '03:00 PM', section: 'recycling',
    status: 'completed', title: 'Recycling Session', subtitle: 'Plastic ×10',
    location: 'HCMUT Station', points: 100, transactionId: 'TXN-E99F33',
  },
  // Points
  {
    id: 'h011', date: '2026-07-06', time: '09:15 AM', section: 'points',
    status: 'completed', title: 'Points Earned', subtitle: 'From recycling session',
    points: 46, transactionId: 'PTX-001F',
  },
  {
    id: 'h012', date: '2026-07-05', time: '04:31 PM', section: 'points',
    status: 'completed', title: 'Points Earned', subtitle: 'From recycling session',
    points: 32, transactionId: 'PTX-002G',
  },
  {
    id: 'h013', date: '2026-07-04', time: '11:05 AM', section: 'points',
    status: 'completed', title: 'Milestone Bonus', subtitle: 'Reached 100 items',
    points: 200, transactionId: 'PTX-003H',
  },
  {
    id: 'h014', date: '2026-06-30', time: '06:00 PM', section: 'points',
    status: 'completed', title: 'Points Redeemed', subtitle: 'Parking ticket',
    points: -2000, transactionId: 'PTX-004I',
  },
  // Vouchers
  {
    id: 'h021', date: '2026-07-03', time: '02:00 PM', section: 'vouchers',
    status: 'used', title: 'Voucher Used', voucherName: 'Digital Parking Ticket',
    location: 'HCMUT Parking', transactionId: 'VTX-001A',
  },
  {
    id: 'h022', date: '2026-06-25', time: '12:00 PM', section: 'vouchers',
    status: 'expired', title: 'Voucher Expired', voucherName: 'Free CocaCola',
    transactionId: 'VTX-002B',
  },
  {
    id: 'h023', date: '2026-07-06', time: '09:15 AM', section: 'vouchers',
    status: 'pending', title: 'Voucher Active', voucherName: 'Free Water Bottle',
    location: 'Circle K Lý Thường Kiệt', transactionId: 'VTX-003C',
  },
  // Missions
  {
    id: 'h031', date: '2026-07-04', time: '11:10 AM', section: 'missions',
    status: 'completed', title: 'Mission Completed', subtitle: 'Recycle 100 items',
    points: 200, transactionId: 'MTX-001X',
  },
  {
    id: 'h032', date: '2026-06-30', time: '09:00 PM', section: 'missions',
    status: 'completed', title: 'Mission Completed', subtitle: '7-Day Streak',
    points: 150, transactionId: 'MTX-002Y',
  },
  {
    id: 'h033', date: '2026-06-15', time: '08:30 AM', section: 'missions',
    status: 'failed', title: 'Mission Failed', subtitle: 'Monthly 500pts goal',
    transactionId: 'MTX-003Z',
  },
];

const SECTION_TABS: { key: HistorySection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'recycling', label: 'Recycling', icon: 'leaf-outline' },
  { key: 'points', label: 'Points', icon: 'star-outline' },
  { key: 'vouchers', label: 'Vouchers', icon: 'ticket-outline' },
  { key: 'missions', label: 'Missions', icon: 'trophy-outline' },
];

const TIME_TABS: { key: TimePeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

const PAGE_SIZE = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<HistoryStatus, { color: string; bg: string; label: string }> = {
  completed: { color: Colors.success, bg: Colors.successLight, label: 'Completed' },
  pending: { color: Colors.info, bg: '#EFF6FF', label: 'Active' },
  failed: { color: Colors.error, bg: Colors.errorLight, label: 'Failed' },
  expired: { color: Colors.textMuted, bg: Colors.backgroundCard, label: 'Expired' },
  used: { color: Colors.textMuted, bg: Colors.backgroundCard, label: 'Used' },
};

const sectionIcon: Record<HistorySection, keyof typeof Ionicons.glyphMap> = {
  recycling: 'leaf',
  points: 'star',
  vouchers: 'ticket',
  missions: 'trophy',
};

const sectionColor: Record<HistorySection, string> = {
  recycling: Colors.primary,
  points: Colors.rankingGold,
  vouchers: Colors.info,
  missions: Colors.warning,
};

function isInPeriod(dateStr: string, period: TimePeriod): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayMs = 86400000;
  if (period === 'today') return diff < dayMs;
  if (period === 'week') return diff < 7 * dayMs;
  if (period === 'month') return diff < 30 * dayMs;
  return diff < 365 * dayMs;
}

// ─── History Card ─────────────────────────────────────────────────────────────

const HistoryCard = ({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) => {
  const sc = statusConfig[entry.status];
  const ic = sectionIcon[entry.section];
  const col = sectionColor[entry.section];
  const isNegative = entry.points !== undefined && entry.points < 0;

  return (
    <View style={styles.cardWrapper}>
      {/* Timeline dot + line */}
      <View style={styles.timelineColumn}>
        <View style={[styles.timelineDot, { backgroundColor: col }]}>
          <Ionicons name={ic} size={10} color={Colors.textWhite} />
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Card content */}
      <View style={styles.card}>
        {/* Date/time + status */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{entry.date} · {entry.time}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{entry.title}</Text>

        {/* Subtitle */}
        {entry.subtitle && <Text style={styles.cardSubtitle}>{entry.subtitle}</Text>}
        {entry.voucherName && (
          <Text style={styles.cardSubtitle}>🎟️ {entry.voucherName}</Text>
        )}

        {/* Location */}
        {entry.location && (
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.cardMetaText}>{entry.location}</Text>
          </View>
        )}

        {/* Points */}
        {entry.points !== undefined && (
          <View style={styles.cardMeta}>
            <Text style={[
              styles.cardPoints,
              isNegative ? styles.cardPointsNeg : styles.cardPointsPos,
            ]}>
              {isNegative ? '' : '+'}{entry.points} pts
            </Text>
          </View>
        )}

        {/* Transaction ID */}
        <Text style={styles.cardTxId}>#{entry.transactionId}</Text>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { isLargeScreen } = useResponsive();
  const [section, setSection] = useState<HistorySection>('recycling');
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return MOCK_HISTORY.filter((e) => {
      if (e.section !== section) return false;
      if (!isInPeriod(e.date, period)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.subtitle ?? '').toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q) ||
          (e.voucherName ?? '').toLowerCase().includes(q) ||
          e.transactionId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [section, period, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const handleSectionChange = (s: HistorySection) => {
    setSection(s);
    setPage(1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader rightIcon="none" showBack />

      {/* Page title */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>History</Text>
      </View>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionTabScroll}
        style={styles.sectionTabBar}
      >
        {SECTION_TABS.map((tab) => {
          const active = section === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.sectionTab, active && { backgroundColor: sectionColor[tab.key] }]}
              onPress={() => handleSectionChange(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={active ? Colors.textWhite : Colors.textMuted}
              />
              <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search + time filter */}
      <View style={styles.controlsRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search history..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={(t) => { setSearch(t); setPage(1); }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Time period pills */}
      <View style={styles.timePeriodRow}>
        {TIME_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.timePill, period === t.key && styles.timePillActive]}
            onPress={() => { setPeriod(t.key); setPage(1); }}
          >
            <Text style={[styles.timePillText, period === t.key && styles.timePillTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No records found"
          description={`No ${section} history for the selected period`}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.listContent, isLargeScreen && styles.listContentDesktop]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timeline}>
            {paginated.map((entry, idx) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                isLast={idx === paginated.length - 1}
              />
            ))}
          </View>

          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setPage((p) => p + 1)}
            >
              <Text style={styles.loadMoreText}>Load more</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },

  titleRow: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { fontSize: FontSize['4xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },

  // Section tabs
  sectionTabBar: { maxHeight: 48 },
  sectionTabScroll: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.sm },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTabText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  sectionTabTextActive: { color: Colors.textWhite },

  // Search + controls
  controlsRow: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.xs,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, paddingVertical: 0 },

  // Time period
  timePeriodRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timePillText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  timePillTextActive: { color: Colors.textWhite },

  // Scroll
  scroll: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  listContentDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },

  // Timeline
  timeline: {},
  cardWrapper: { flexDirection: 'row', marginBottom: Spacing.sm },
  timelineColumn: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
    marginBottom: -4,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
    marginBottom: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  cardMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardPoints: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  cardPointsPos: { color: Colors.primary },
  cardPointsNeg: { color: Colors.error },
  cardTxId: {
    fontSize: FontSize.xs,
    color: Colors.borderMuted,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.medium },

  bottomSpacer: { height: Spacing.base },
});
