/**
 * GreenGuard Dashboard — Page 1: Dashboard
 * Dynamic 3-Class System & Real-Time Live Feed Binding
 */
import React, { memo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { AlertTriangle, WifiOff, Wrench, Activity, Zap, CheckCircle2 } from 'lucide-react-native';

import { DashboardSidebar, SIDEBAR_WIDTH } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { KPICard } from '@/components/KPICard';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/theme/colors';
import { DashboardRoute, KPICardData } from '@/types/dashboard.types';
import { DEMO_MODE } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { dashboardQuery } from '@/services/dashboardQueries';
import { DataStatus } from '@/components/DataStatus';

interface Props {
  onNavigate: (route: DashboardRoute) => void;
}

// ─── Mini Pie (3-Class Waste Breakdown) ───────────────────────────────────────
const WastePie = memo(({ waste }: { waste: { pet_clean: number; pet_bad: number; aluminum: number } }) => {
  const total = Math.max(1, waste.pet_clean + waste.pet_bad + waste.aluminum);
  const cleanPct = Math.round((waste.pet_clean / total) * 100);
  const badPct = Math.round((waste.pet_bad / total) * 100);
  const alumPct = waste.pet_clean + waste.pet_bad + waste.aluminum === 0 ? 0 : Math.max(0, 100 - cleanPct - badPct);

  const slices = [
    { label: 'PET Sạch', percentage: cleanPct, count: waste.pet_clean, color: '#10B981' },
    { label: 'PET Còn nắp/nhãn', percentage: badPct, count: waste.pet_bad, color: '#F59E0B' },
    { label: 'Lon nhôm', percentage: alumPct, count: waste.aluminum, color: '#06B6D4' },
  ];

  const pieData = slices.map((s) => ({
    value: s.percentage,
    color: s.color,
  }));

  const totalKg = Number(((waste.pet_clean * 0.022) + (waste.pet_bad * 0.024) + (waste.aluminum * 0.015)).toFixed(1));

  return (
    <View style={pieStyles.wrap}>
      <View style={pieStyles.chartWrap}>
        {waste.pet_clean + waste.pet_bad + waste.aluminum > 0 ? (
        <PieChart
          donut
          innerRadius={32}
          radius={50}
          data={pieData.length > 0 ? pieData : [{ value: 100, color: '#10B981' }]}
          centerLabelComponent={() => (
            <View style={pieStyles.center}>
              <Text style={pieStyles.centerNum}>{totalKg}</Text>
              <Text style={pieStyles.centerUnit}>kg</Text>
            </View>
          )}
        />
        ) : <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Chưa có dữ liệu</Text>}
      </View>
      {/* Legend */}
      <View style={pieStyles.legend}>
        {slices.map((s) => (
          <View key={s.label} style={pieStyles.legendItem}>
            <View style={[pieStyles.dot, { backgroundColor: s.color }]} />
            <Text style={pieStyles.legendLabel}>{s.label}</Text>
            <Text style={pieStyles.legendPct}>{s.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const pieStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartWrap: { width: 100, height: 100 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerNum: { fontSize: 15, fontWeight: '700' as const, color: Colors.textPrimary },
  centerUnit: { fontSize: 11, color: Colors.textMuted, marginTop: -2 },
  legend: { flex: 1, gap: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 11, color: Colors.textSecondary },
  legendPct: { fontSize: 11, fontWeight: '600' as const, color: Colors.textPrimary },
});

// ─── Compartment Bar ──────────────────────────────────────────────────────────
const CompartmentBar = memo(({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={compStyles.row}>
    <Text style={compStyles.label}>{label}</Text>
    <View style={compStyles.barBg}>
      <View style={[compStyles.barFill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
    </View>
    <Text style={compStyles.pct}>{value}%</Text>
  </View>
));

const compStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { width: 85, fontSize: 11, color: Colors.textSecondary },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.tableBorder, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pct: { width: 34, fontSize: 11, fontWeight: '600' as const, color: Colors.textPrimary, textAlign: 'right' },
});

// ─── Fill Bar ─────────────────────────────────────────────────────────────────
const FillBar = memo(({ value }: { value: number }) => {
  const color = value >= 80 ? Colors.binNearlyFull : value >= 50 ? Colors.kpiGreen : Colors.binOnline;
  return (
    <View style={fillStyles.track}>
      <View style={[fillStyles.fill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
    </View>
  );
});
const fillStyles = StyleSheet.create({
  track: { width: 60, height: 5, backgroundColor: Colors.tableBorder, borderRadius: 3 },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Main Dashboard Screen ────────────────────────────────────────────────────
export default function DashboardScreen({ onNavigate }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 900;
  const contentPadding = isCompact ? 14 : 22;
  const contentWidth = Math.max(240, windowWidth - SIDEBAR_WIDTH - contentPadding * 2);
  const chartWidth = isCompact
    ? Math.max(220, contentWidth - 36)
    : Math.max(360, Math.round(contentWidth * 0.64 - 90));
  const snapshot = useQuery(dashboardQuery());
  if (!snapshot.data) return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="dashboard" onNavigate={onNavigate} />
      <View style={styles.main}>
        <DashboardTopNav title="GreenGuard AI Dashboard" subtitle="Dữ liệu trực tiếp" />
        <DataStatus demo={false} error={snapshot.isError} />
      </View>
    </SafeAreaView>
  );
  const { overview, liveFeed, machines } = snapshot.data;

  const kpis: KPICardData[] = [
    {
      id: 'k1',
      label: 'Tổng thu nhận hôm nay',
      value: `${overview.todayDetections}`,
      unit: 'items',
      subLabel: `${overview?.wasteBreakdown?.pet_clean ?? 0} sạch, ${overview?.wasteBreakdown?.pet_bad ?? 0} nắp/nhãn`,
      trend: 'up',
      iconType: 'trash',
      iconColor: Colors.kpiGreen,
      iconBg: Colors.kpiGreenBg,
    },
    {
      id: 'k2',
      label: 'Độ chuẩn phân loại (Purity)',
      value: overview.purityRate == null ? '—' : `${overview.purityRate}%`,
      subLabel: 'Mục tiêu: > 90% PET sạch',
      trend: overview.purityRate == null ? undefined : overview.purityRate >= 90 ? 'up' : 'down',
      iconType: 'accuracy',
      iconColor: '#10B981',
      iconBg: '#ECFDF5',
    },
    {
      id: 'k3',
      label: 'Smart Bins Online',
      value: overview.binsOnline,
      subLabel: `${machines.length} máy cấu hình`,
      iconType: 'wifi',
      iconColor: Colors.kpiGreen,
      iconBg: Colors.kpiGreenBg,
    },
    {
      id: 'k4',
      label: 'AI FPS & Latency',
      value: overview.avgFps == null ? '—' : `${overview.avgFps} FPS`,
      subLabel: DEMO_MODE ? 'Độ trễ ~35ms (RTX Jetson)' : 'Độ trễ: xem trang Analytics',
      trend: 'up',
      iconType: 'bar',
      iconColor: Colors.kpiBlue,
      iconBg: Colors.kpiBlueBg,
    },
  ];

  const trendData = overview.classificationTrend.map((p) => ({ value: p.value, label: p.label, frontColor: Colors.chartBar }));

  const waste = overview.wasteBreakdown;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="dashboard" onNavigate={onNavigate} />

      {/* Content area */}
      <View style={styles.main}>
        <DashboardTopNav
          title="GreenGuard AI Dashboard"
          subtitle={`Hệ thống giám sát trạm tái chế thông minh (3-Class Telemetry)${DEMO_MODE ? ' · PRESENTATION MODE' : ''}`}
        />

        {!DEMO_MODE && <DataStatus demo={false} error={snapshot.isError} updatedAt={snapshot.dataUpdatedAt} />}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI Row ───────────────────────────────────────────────── */}
          <View style={[styles.kpiRow, isCompact && styles.kpiRowCompact]}>
            {kpis.map((kpi) => (
              <KPICard key={kpi.id} data={kpi} style={isCompact ? styles.kpiCardCompact : undefined} />
            ))}
          </View>

          {/* ── Row 2: Classification Trend + Waste Breakdown ─────────── */}
          <View style={[styles.row2, isCompact && styles.rowStacked]}>
            {/* Classification Trend */}
            <SectionCard
              title="Xu hướng nhận diện hôm nay"
              style={[styles.trendCard, isCompact && styles.compactCard]}
              rightElement={
                <View style={styles.filterRow}>
                  <TouchableOpacity style={styles.filterBtnActive}>
                    <Text style={styles.filterTextActive}>Hôm nay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterBtn}>
                    <Text style={styles.filterText}>7 ngày</Text>
                  </TouchableOpacity>
                </View>
              }
            >
              <BarChart
                data={trendData}
                barWidth={14}
                spacing={12}
                roundedTop
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                noOfSections={4}
                height={160}
                barBorderRadius={3}
                hideRules={false}
                rulesColor={Colors.dashboardBorder}
                rulesThickness={1}
                initialSpacing={10}
                endSpacing={10}
                width={chartWidth}
              />
            </SectionCard>

            {/* Right column: Compartment + Waste Pie */}
            <View style={[styles.rightCol, isCompact && styles.rightColCompact]}>
              <SectionCard title={DEMO_MODE ? "Dung lượng ngăn chứa (Bins)" : "Số lượng hôm nay / mốc 30 items"} style={[styles.compartmentCard, isCompact && styles.compactCard]}>
                <CompartmentBar label="PET Sạch (10đ)" value={Math.min(100, Math.round((waste.pet_clean / 30) * 100))} color="#10B981" />
                <CompartmentBar label="PET Có nắp (5đ)" value={Math.min(100, Math.round((waste.pet_bad / 30) * 100))} color="#F59E0B" />
                <CompartmentBar label="Lon nhôm (8đ)" value={Math.min(100, Math.round((waste.aluminum / 30) * 100))} color="#06B6D4" />
              </SectionCard>

              <SectionCard title="Phân bổ vật liệu 3 lớp" style={[styles.pieCard, isCompact && styles.compactCard]}>
                <WastePie waste={waste} />
              </SectionCard>
            </View>
          </View>

          {/* ── Row 3: Live Telemetry Feed + Smart Bins ──────── */}
          <View style={[styles.row3, isCompact && styles.rowStacked]}>
            {/* Live Feed */}
            <SectionCard title="Luồng sự kiện AI trực tiếp (Live Stream)" style={[styles.tableCard, isCompact && styles.compactCard]} noPadding>
              {/* Table header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                {(isCompact ? ['Sự kiện', 'Đối tượng · giờ', 'Tin cậy'] : ['Sự kiện', 'Đối tượng', 'Giờ', 'Tin cậy / Điểm']).map((h) => (
                  <Text key={h} style={[styles.tableCell, styles.tableHeaderText, isCompact && styles.tableHeaderCompact]}>
                    {h}
                  </Text>
                ))}
              </View>

              {liveFeed.slice(0, 8).map((feed, i) => {
                const isClaim = feed.kind === 'claim';
                const timeStr = new Date(feed.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                let typeBadgeColor = '#10B981';
                let typeLabel = 'PET Sạch';

                if (feed.detectedType === 'pet_bad') {
                  typeBadgeColor = '#F59E0B';
                  typeLabel = 'PET Có nắp/nhãn';
                } else if (feed.detectedType === 'aluminum') {
                  typeBadgeColor = '#06B6D4';
                  typeLabel = 'Lon nhôm';
                } else if (feed.detectedType === 'reject') {
                  typeBadgeColor = '#EF4444';
                  typeLabel = 'Từ chối (Reject)';
                }

                return (
                  <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                    <View style={[styles.tableCell, styles.row]}>
                      <View style={[styles.typeDot, { backgroundColor: isClaim ? '#8B5CF6' : typeBadgeColor }]} />
                      <Text style={[styles.tableCellBold, { color: isClaim ? '#8B5CF6' : Colors.textPrimary }]}>
                        {isClaim ? 'Đổi thưởng (Claim)' : typeLabel}
                      </Text>
                    </View>

                    {isCompact ? (
                      <View style={[styles.tableCell, styles.compactObjectCell]}>
                        <Text style={[styles.tableCellText, styles.compactObjectText]} numberOfLines={1}>
                          {isClaim ? `${feed.userName}` : `Trạm ${feed.machineCode}`}
                        </Text>
                        <Text style={styles.textSm}>{timeStr}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.tableCell, styles.tableCellText]}>
                          {isClaim ? `${feed.userName}` : `Trạm ${feed.machineCode}`}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellText, styles.textSm]}>
                          {timeStr}
                        </Text>
                      </>
                    )}

                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellBold,
                        isCompact && styles.compactConfidence,
                        { color: isClaim ? '#8B5CF6' : feed.confidence && feed.confidence >= 0.85 ? '#10B981' : '#F59E0B' },
                      ]}
                    >
                      {isClaim ? `+${feed.points} pts` : `${((feed.confidence ?? 0.8) * 100).toFixed(1)}%`}
                    </Text>
                  </View>
                );
              })}
            </SectionCard>

            {/* Smart Bin Status */}
            <SectionCard title="Trạng thái máy phân loại (Smart Bins)" style={[styles.binCard, isCompact && styles.compactCard]} noPadding>
              {machines.map((m, i) => (
                <View key={m._id || i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.tableCellBold, { flex: 0.9 }]}>{m.machineCode || '0001'}</Text>
                  <View style={[styles.tableCell, { flex: 1 }]}>
                    <StatusBadge status={m.status === 'online' ? 'Online' : 'Offline'} />
                  </View>
                  <View style={[styles.tableCell, styles.row, { flex: 1.3, gap: 5 }]}>
                    {m.bins?.[0]?.capacityPercent != null || DEMO_MODE ? <FillBar value={m.bins?.[0]?.capacityPercent ?? 45} /> : <Text style={styles.textSm}>—</Text>}
                  </View>
                  <Text style={[styles.tableCell, styles.tableCellText, { flex: 0.8, textAlign: 'right' }]}>
                    {DEMO_MODE ? (m.lastSeenAt ? 'Vừa xong' : 'Online') : m.lastHeartbeatAt ? new Date(m.lastHeartbeatAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Text>
                </View>
              ))}
            </SectionCard>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dashboardBg },
  main: { flex: 1, marginLeft: SIDEBAR_WIDTH },
  scroll: { flex: 1 },
  content: { padding: 22, gap: 16 },
  contentCompact: { padding: 14, gap: 12 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 14 },
  kpiRowCompact: { flexWrap: 'wrap', gap: 10 },
  kpiCardCompact: { flexBasis: '48%', maxWidth: '48%' },

  // Row 2
  row2: { flexDirection: 'row', gap: 14 },
  rowStacked: { flexDirection: 'column', gap: 12 },
  trendCard: { flex: 1.6 },
  compactCard: { width: '100%', flexGrow: 0, flexShrink: 1, flexBasis: 'auto' },
  rightCol: { flex: 1, gap: 14 },
  rightColCompact: { width: '100%', flexGrow: 0, flexShrink: 1, flexBasis: 'auto', gap: 12 },
  compartmentCard: { flex: 1 },
  pieCard: {},

  // Row 3
  row3: { flexDirection: 'row', gap: 14 },
  tableCard: { flex: 1.3 },
  binCard: { flex: 1 },

  // Table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.tableBorder,
  },
  tableHeader: { backgroundColor: Colors.tableHeader },
  tableRowAlt: { backgroundColor: Colors.tableRowAlt },
  tableCell: { flex: 1 },
  tableHeaderText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
  tableHeaderCompact: { fontSize: 10, letterSpacing: 0.3 },
  tableCellText: { fontSize: 12, color: Colors.textSecondary, flexShrink: 1 },
  tableCellBold: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary, flexShrink: 1 },
  compactObjectCell: { flex: 1.25, minWidth: 0 },
  compactObjectText: { maxWidth: '100%' },
  compactConfidence: { flex: 0.75 },
  textSm: { fontSize: 11, color: Colors.textMuted },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Charts
  axisText: { fontSize: 11, color: Colors.textMuted },

  // Misc
  filterRow: { flexDirection: 'row', gap: 4 },
  filterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.dashboardBorder,
  },
  filterBtnActive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  filterText: { fontSize: 10, color: Colors.textMuted },
  filterTextActive: { fontSize: 10, color: '#fff', fontWeight: '600' as const },
});
