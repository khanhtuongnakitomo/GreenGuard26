/**
 * GreenGuard Dashboard — Page 1: Dashboard
 * Dynamic 3-Class System & Real-Time Live Feed Binding
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import QRCode from 'react-native-qrcode-svg';
import { AlertTriangle, WifiOff, Wrench, Activity, Zap, CheckCircle2 } from 'lucide-react-native';

import { DashboardSidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { KPICard } from '@/components/KPICard';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/theme/colors';
import { DashboardRoute, KPICardData } from '@/types/dashboard.types';
import { DashboardRange, fetchFeedPage, getDashboardEventStreamUrl, LiveFeedItem } from '@/services/api';
import { DEMO_MODE } from '@/services/api';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardQuery } from '@/services/dashboardQueries';
import { exportDashboardReport } from '@/services/reportExport';
import { DataStatus } from '@/components/DataStatus';

interface Props {
  onNavigate: (route: DashboardRoute) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const MATERIALS = {
  pet_clean: { label: 'PET tốt', color: Colors.materialGoodPet },
  pet_bad: { label: 'PET tệ', color: Colors.materialBadPet },
  aluminum: { label: 'Lon nhôm', color: Colors.materialCan },
} as const;

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string; summaryLabel: string }> = [
  { value: 'today', label: 'Hôm nay', summaryLabel: 'hôm nay' },
  { value: 'week', label: '7 ngày', summaryLabel: '7 ngày qua' },
  { value: 'month', label: '30 ngày', summaryLabel: '30 ngày qua' },
  { value: 'all', label: 'Tất cả', summaryLabel: 'toàn thời gian' },
];

function materialPresentation(detectedType?: string) {
  if (detectedType === 'pet_bad') return MATERIALS.pet_bad;
  if (detectedType === 'aluminum') return MATERIALS.aluminum;
  return MATERIALS.pet_clean;
}

// ─── Mini Pie (3-Class Waste Breakdown) ───────────────────────────────────────
const WastePie = memo(({ waste }: { waste: { pet_clean: number; pet_bad: number; aluminum: number } }) => {
  const total = Math.max(1, waste.pet_clean + waste.pet_bad + waste.aluminum);
  const cleanPct = Math.round((waste.pet_clean / total) * 100);
  const badPct = Math.round((waste.pet_bad / total) * 100);
  const alumPct = waste.pet_clean + waste.pet_bad + waste.aluminum === 0 ? 0 : Math.max(0, 100 - cleanPct - badPct);

  const slices = [
    { label: MATERIALS.pet_clean.label, percentage: cleanPct, count: waste.pet_clean, color: MATERIALS.pet_clean.color },
    { label: MATERIALS.pet_bad.label, percentage: badPct, count: waste.pet_bad, color: MATERIALS.pet_bad.color },
    { label: MATERIALS.aluminum.label, percentage: alumPct, count: waste.aluminum, color: MATERIALS.aluminum.color },
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

const BinFillKpi = memo(({ machines, style }: { machines: any[]; style?: object }) => {
  const compartments = machines.flatMap((machine) => Array.isArray(machine.bins) ? machine.bins : []);
  const values = compartments
    .map((bin) => Number(bin.capacityPercent))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.min(100, Math.max(0, value)));
  const fillPercent = values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const fillColor = fillPercent == null ? Colors.textMuted : fillPercent >= 80 ? Colors.binError : fillPercent >= 60 ? Colors.binNearlyFull : Colors.binOnline;

  return (
    <View style={[binKpiStyles.card, style]}>
      <View style={binKpiStyles.iconWrap}>
        <Wrench size={20} color={Colors.kpiGreen} strokeWidth={2} />
      </View>
      <Text style={binKpiStyles.label}>Dung lượng ngăn chứa</Text>
      <View style={binKpiStyles.valueRow}>
        <Text style={binKpiStyles.value}>{fillPercent == null ? '—' : fillPercent}</Text>
        <Text style={binKpiStyles.unit}>%</Text>
      </View>
      <View style={binKpiStyles.track}>
        <View style={[binKpiStyles.fill, { width: `${fillPercent ?? 0}%` as any, backgroundColor: fillColor }]} />
      </View>
      <Text style={binKpiStyles.sub}>{values.length > 0 ? `${values.length} ngăn đang được theo dõi` : 'Chưa có dữ liệu dung lượng'}</Text>
    </View>
  );
});

const binKpiStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.dashboardCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.dashboardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: Colors.kpiGreenBg },
  label: { fontSize: 14, color: Colors.textMuted, marginBottom: 5, fontWeight: '500' as const },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 7 },
  value: { fontSize: 28, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.6 },
  unit: { fontSize: 14, fontWeight: '600' as const, color: Colors.textMuted, marginBottom: 2, marginLeft: 2 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: Colors.tableBorder, marginBottom: 7 },
  fill: { height: '100%', borderRadius: 4 },
  sub: { fontSize: 12, color: Colors.textMuted },
});

const FeedColumn = memo(({ title, items, claim, total, hasMore, isLoading, isFetchingMore, onLoadMore }: {
  title: string;
  items: LiveFeedItem[];
  claim: boolean;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}) => (
  <SectionCard title={title} style={styles.feedColumn} noPadding>
    <View style={[styles.tableRow, styles.tableHeader]}>
      <Text style={[styles.tableCell, styles.tableHeaderText]}>Sự kiện</Text>
      <Text style={[styles.tableCell, styles.tableHeaderText]}>Đối tượng · giờ</Text>
      <Text style={[styles.tableCell, styles.tableHeaderText]}>Tin cậy / Điểm</Text>
    </View>
    {items.map((feed, i) => {
      const timeStr = new Date(feed.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const material = materialPresentation(feed.detectedType);
      const typeLabel = feed.detectedType === 'reject' ? 'Từ chối' : material.label;
      const typeColor = feed.detectedType === 'reject' ? Colors.error : material.color;
      return (
        <View key={`${feed.time}-${i}`} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
          <View style={[styles.tableCell, styles.row]}>
            <View style={[styles.typeDot, { backgroundColor: claim ? '#8B5CF6' : typeColor }]} />
            <Text style={[styles.tableCellBold, { color: claim ? '#8B5CF6' : typeColor }]}>
              {claim ? 'Đổi thưởng (Claim)' : typeLabel}
            </Text>
          </View>
          <View style={[styles.tableCell, styles.compactObjectCell]}>
            <Text style={[styles.tableCellText, styles.compactObjectText]} numberOfLines={1}>
              {claim ? `${feed.userName ?? 'Người dùng'}` : `Trạm ${feed.machineCode}`}
            </Text>
            <Text style={styles.textSm}>{timeStr}</Text>
          </View>
          <Text style={[styles.tableCell, styles.tableCellBold, { color: claim ? '#8B5CF6' : typeColor }]}>
            {claim ? `+${feed.points ?? 0} pts` : `${((feed.confidence ?? 0) * 100).toFixed(1)}%`}
          </Text>
        </View>
      );
    })}
    {items.length === 0 && <Text style={styles.feedEmpty}>{isLoading ? 'Đang tải lịch sử…' : claim ? 'Chưa có lượt nhận điểm.' : 'Chưa có phát hiện.'}</Text>}
    {items.length > 0 && (
      <View style={styles.feedFooter}>
        <Text style={styles.feedCount}>Hiển thị {items.length}/{total}</Text>
        {hasMore ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore} disabled={isFetchingMore}>
            {isFetchingMore ? <ActivityIndicator size="small" color={Colors.textWhite} /> : <Text style={styles.loadMoreText}>Tải thêm 10</Text>}
          </TouchableOpacity>
        ) : <Text style={styles.feedComplete}>Đã tải hết</Text>}
      </View>
    )}
  </SectionCard>
));

// ─── Main Dashboard Screen ────────────────────────────────────────────────────
export default function DashboardScreen({ onNavigate, sidebarCollapsed, onToggleSidebar }: Props) {
  const [range, setRange] = useState<DashboardRange>('today');
  const [isRangeTransition, setIsRangeTransition] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const isCompact = windowWidth < 900;
  const contentPadding = isCompact ? 14 : 22;
  const contentWidth = Math.max(240, windowWidth - sidebarWidth - contentPadding * 2);
  const chartWidth = isCompact
    ? Math.max(220, contentWidth - 36)
    : Math.max(360, Math.round(contentWidth * 0.64 - 90));
  const snapshot = useQuery(dashboardQuery(range));
  const detectionFeed = useInfiniteQuery({
    queryKey: ['dashboard', 'feed', 'detection', DEMO_MODE],
    queryFn: ({ pageParam, signal }) => fetchFeedPage('detection', 10, Number(pageParam), signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.offset + lastPage.data.length : undefined,
    retry: false,
  });
  const claimFeed = useInfiniteQuery({
    queryKey: ['dashboard', 'feed', 'claim', DEMO_MODE],
    queryFn: ({ pageParam, signal }) => fetchFeedPage('claim', 10, Number(pageParam), signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.offset + lastPage.data.length : undefined,
    retry: false,
  });
  const trendOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRangeTransition) return;
    Animated.timing(trendOpacity, {
      toValue: snapshot.isFetching ? 0.42 : 1,
      duration: snapshot.isFetching ? 140 : 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !snapshot.isFetching) setIsRangeTransition(false);
    });
  }, [isRangeTransition, snapshot.isFetching, trendOpacity]);

  useEffect(() => {
    if (DEMO_MODE || typeof EventSource === 'undefined') return;
    const stream = new EventSource(getDashboardEventStreamUrl());
    stream.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'snapshot'] });
    };
    return () => stream.close();
  }, [queryClient]);

  if (!snapshot.data) return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="dashboard" onNavigate={onNavigate} collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
      <View style={[styles.main, { marginLeft: sidebarWidth }]}>
        <DashboardTopNav title="GreenGuard AI Dashboard" subtitle="Dữ liệu trực tiếp" />
        <DataStatus demo={false} error={snapshot.isError} />
      </View>
    </SafeAreaView>
  );
  const { overview, machines, latestSession } = snapshot.data;
  const detectionHistory = detectionFeed.data?.pages.flatMap((page) => page.data) ?? [];
  const claimHistory = claimFeed.data?.pages.flatMap((page) => page.data) ?? [];
  const liveFeed = [...detectionHistory, ...claimHistory]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const detectionTotal = detectionFeed.data?.pages[0]?.total ?? 0;
  const claimTotal = claimFeed.data?.pages[0]?.total ?? 0;
  const activeRange = RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[0];
  const totalDetections = overview.totalDetections ?? overview.todayDetections;
  const sessionSecondsRemaining = latestSession?.status === 'collecting' && latestSession.timeoutAt
    ? Math.max(0, Math.ceil((new Date(latestSession.timeoutAt).getTime() - Date.now()) / 1000))
    : 0;
  const sessionLabels: Record<string, string> = {
    pet_clean: 'PET tốt',
    pet_bad: 'PET tệ',
    aluminum: 'Lon nhôm',
  };

  const kpis: KPICardData[] = [
    {
      id: 'k1',
      label: `Tổng thu nhận ${activeRange.summaryLabel}`,
      value: `${totalDetections}`,
      unit: 'items',
      subLabel: `${overview?.wasteBreakdown?.pet_clean ?? 0} PET tốt, ${overview?.wasteBreakdown?.pet_bad ?? 0} PET tệ`,
      trend: 'up',
      iconType: 'trash',
      iconColor: Colors.kpiGreen,
      iconBg: Colors.kpiGreenBg,
    },
    {
      id: 'k2',
      label: 'Độ chuẩn phân loại (Purity)',
      value: overview.purityRate == null ? '—' : `${overview.purityRate}%`,
      subLabel: 'Mục tiêu: > 90% PET tốt',
      trend: overview.purityRate == null ? undefined : overview.purityRate >= 90 ? 'up' : 'down',
      iconType: 'accuracy',
      iconColor: '#10B981',
      iconBg: '#ECFDF5',
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

  const trendStackData = overview.classificationTrend.map((p) => ({
    label: p.label,
    stacks: [
      { value: p.pet_clean ?? p.value, color: MATERIALS.pet_clean.color },
      { value: p.pet_bad ?? 0, color: MATERIALS.pet_bad.color },
      { value: p.aluminum ?? 0, color: MATERIALS.aluminum.color },
    ],
  }));
  const trendBarWidth = Math.max(5, Math.min(14, Math.floor(chartWidth / Math.max(12, trendStackData.length * 2))));
  const trendSpacing = Math.max(3, Math.min(12, Math.floor(chartWidth / Math.max(12, trendStackData.length * 1.5))));

  const waste = overview.wasteBreakdown;

  const handleExport = () => {
    try {
      const fileName = exportDashboardReport({
        overview,
        liveFeed,
        range,
      });
      setExportNotice(`Đã tải báo cáo: ${fileName}`);
    } catch (error) {
      setExportNotice(`Không thể tạo báo cáo: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="dashboard" onNavigate={onNavigate} collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />

      {/* Content area */}
      <View style={[styles.main, { marginLeft: sidebarWidth }]}>
        <DashboardTopNav
          title="GreenGuard AI Dashboard"
          subtitle={`Hệ thống giám sát trạm tái chế thông minh (3-Class Telemetry)${DEMO_MODE ? ' · PRESENTATION MODE' : ''}`}
          onExportPress={handleExport}
        />

        {!DEMO_MODE && !snapshot.isPlaceholderData && (
          <DataStatus demo={false} error={snapshot.isError} updatedAt={snapshot.dataUpdatedAt} />
        )}
        {exportNotice ? (
          <TouchableOpacity style={styles.exportNotice} onPress={() => setExportNotice('')}>
            <Text style={styles.exportNoticeText}>{exportNotice}</Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI Row ───────────────────────────────────────────────── */}
          <View style={[styles.kpiRow, isCompact && styles.kpiRowCompact]}>
            {kpis.slice(0, 2).map((kpi) => (
              <KPICard key={kpi.id} data={kpi} style={isCompact ? styles.kpiCardCompact : undefined} />
            ))}
            <BinFillKpi machines={machines} style={isCompact ? styles.kpiCardCompact : undefined} />
            {kpis.slice(2).map((kpi) => (
              <KPICard key={kpi.id} data={kpi} style={isCompact ? styles.kpiCardCompact : undefined} />
            ))}
          </View>

          {/* ── Row 2: Classification Trend + Waste Breakdown ─────────── */}
          <View style={[styles.row2, isCompact && styles.rowStacked]}>
            {/* Classification Trend */}
            <SectionCard
              title={`Xu hướng nhận diện ${activeRange.summaryLabel}`}
              style={[styles.trendCard, isCompact && styles.compactCard]}
              rightElement={
                <View style={styles.filterRow}>
                  {RANGE_OPTIONS.map((option) => {
                    const active = option.value === range;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          if (option.value !== range) {
                            setIsRangeTransition(true);
                            setRange(option.value);
                          }
                        }}
                        style={active ? styles.filterBtnActive : styles.filterBtn}
                      >
                        <Text style={active ? styles.filterTextActive : styles.filterText}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              }
            >
              <View style={styles.trendChartArea}>
                <Animated.View style={{ opacity: trendOpacity }}>
                  <View style={styles.materialLegend}>
                    {Object.values(MATERIALS).map((material) => (
                      <View key={material.label} style={styles.materialLegendItem}>
                        <View style={[styles.materialLegendDot, { backgroundColor: material.color }]} />
                        <Text style={styles.materialLegendText}>{material.label}</Text>
                      </View>
                    ))}
                  </View>
                  <BarChart
                    key={range}
                    stackData={trendStackData}
                    barWidth={trendBarWidth}
                    spacing={trendSpacing}
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisTextStyle={styles.axisText}
                    xAxisLabelTextStyle={styles.axisText}
                    noOfSections={4}
                    height={160}
                    stackBorderTopLeftRadius={3}
                    stackBorderTopRightRadius={3}
                    hideRules={false}
                    rulesColor={Colors.dashboardBorder}
                    rulesThickness={1}
                    initialSpacing={10}
                    endSpacing={10}
                    width={chartWidth}
                    isAnimated
                    animationDuration={300}
                  />
                </Animated.View>
                {isRangeTransition && snapshot.isFetching && (
                  <View style={styles.rangeLoading} pointerEvents="none">
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.rangeLoadingText}>Đang tải {activeRange.summaryLabel}…</Text>
                  </View>
                )}
              </View>
            </SectionCard>

            {/* Right column: Compartment + Waste Pie */}
            <View style={[styles.rightCol, isCompact && styles.rightColCompact]}>
              <SectionCard title={DEMO_MODE ? "Dung lượng ngăn chứa (Bins)" : `Số lượng ${activeRange.summaryLabel}`} style={[styles.compartmentCard, isCompact && styles.compactCard]}>
                <CompartmentBar label="PET tốt (10đ)" value={Math.min(100, Math.round((waste.pet_clean / 30) * 100))} color={MATERIALS.pet_clean.color} />
                <CompartmentBar label="PET tệ (5đ)" value={Math.min(100, Math.round((waste.pet_bad / 30) * 100))} color={MATERIALS.pet_bad.color} />
                <CompartmentBar label="Lon nhôm (8đ)" value={Math.min(100, Math.round((waste.aluminum / 30) * 100))} color={MATERIALS.aluminum.color} />
              </SectionCard>

              <SectionCard title={`Phân bổ vật liệu · ${activeRange.label}`} style={[styles.pieCard, isCompact && styles.compactCard]}>
                <WastePie waste={waste} />
              </SectionCard>
            </View>
          </View>

          {/* ── Row 3: independent detection and claim feeds ─────── */}
          <View style={[styles.row3, isCompact && styles.rowStacked]}>
            <FeedColumn
              title={`Phát hiện vật phẩm (${detectionTotal})`}
              items={detectionHistory}
              claim={false}
              total={detectionTotal}
              hasMore={detectionFeed.hasNextPage ?? false}
              isLoading={detectionFeed.isLoading}
              isFetchingMore={detectionFeed.isFetchingNextPage}
              onLoadMore={() => detectionFeed.fetchNextPage()}
            />
            <FeedColumn
              title={`Nhận điểm - lịch sử (${claimTotal})`}
              items={claimHistory}
              claim
              total={claimTotal}
              hasMore={claimFeed.hasNextPage ?? false}
              isLoading={claimFeed.isLoading}
              isFetchingMore={claimFeed.isFetchingNextPage}
              onLoadMore={() => claimFeed.fetchNextPage()}
            />
          </View>
          <SectionCard title="Trạng thái máy phân loại (Smart Bins)" style={[styles.binCard, isCompact && styles.compactCard]} noPadding>
            {machines.map((m, i) => (
              <View key={m._id || i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.tableCell, styles.tableCellBold, { flex: 0.9 }]}>{m.machineCode || '0001'}</Text>
                <View style={[styles.tableCell, { flex: 1 }]}><StatusBadge status={m.status === 'online' ? 'Online' : 'Offline'} /></View>
                <View style={[styles.tableCell, styles.row, { flex: 1.3, gap: 5 }]}>{m.bins?.[0]?.capacityPercent != null || DEMO_MODE ? <FillBar value={m.bins?.[0]?.capacityPercent ?? 45} /> : <Text style={styles.textSm}>—</Text>}</View>
                <Text style={[styles.tableCell, styles.tableCellText, { flex: 0.8, textAlign: 'right' }]}>{DEMO_MODE ? (m.lastSeenAt ? 'Vừa xong' : 'Online') : m.lastHeartbeatAt ? new Date(m.lastHeartbeatAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
              </View>
            ))}
          </SectionCard>
          {false && (
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
                let typeLabel = 'PET tốt';

                if (feed.detectedType === 'pet_bad') {
                  typeBadgeColor = '#F59E0B';
                  typeLabel = 'PET tệ';
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
          )}

          {!DEMO_MODE && (
            <SectionCard
              title="Phiên tái chế hiện tại"
              rightElement={latestSession ? (
                <Text style={latestSession.status === 'collecting' ? styles.sessionCollecting : styles.sessionComplete}>
                  {latestSession.status === 'collecting'
                    ? latestSession.finalizationMode === 'manual'
                      ? 'Demo-Day · chờ F để chốt phiên'
                      : `Đang chờ vật phẩm · ${sessionSecondsRemaining}s`
                    : 'Đã hoàn tất · QR sẵn sàng'}
                </Text>
              ) : undefined}
            >
              {!latestSession ? (
                <Text style={styles.emptySession}>Chưa có phiên. Chạy Demo-day-run.bat để bắt đầu.</Text>
              ) : (
                <View style={[styles.sessionContent, isCompact && styles.sessionContentCompact]}>
                  <View style={styles.sessionSummary}>
                    <View style={styles.sessionMetaRow}>
                      <View>
                        <Text style={styles.sessionMetaLabel}>Mã phiên</Text>
                        <Text style={styles.sessionCode}>{latestSession.sessionCode}</Text>
                      </View>
                      <View>
                        <Text style={styles.sessionMetaLabel}>Máy</Text>
                        <Text style={styles.sessionMetaValue}>{latestSession.machineCode ?? '0001'}</Text>
                      </View>
                      <View>
                        <Text style={styles.sessionMetaLabel}>Tổng vật phẩm</Text>
                        <Text style={styles.sessionTotal}>{latestSession.totalItems}</Text>
                      </View>
                      <View>
                        <Text style={styles.sessionMetaLabel}>Tổng điểm</Text>
                        <Text style={styles.sessionPoints}>{latestSession.totalPoints}</Text>
                      </View>
                    </View>
                    <View style={styles.sessionItems}>
                      {latestSession.items.map((item) => (
                        <View key={item.itemType} style={styles.sessionItemRow}>
                          <Text style={[styles.sessionItemName, { color: materialPresentation(item.itemType).color }]}>{sessionLabels[item.itemType] ?? item.itemType}</Text>
                          <Text style={styles.sessionItemDetail}>
                            {item.quantity} vật phẩm · {item.pointsPerItem} điểm/vật phẩm · TB {((item.avgConfidence ?? 0) * 100).toFixed(1)}%
                          </Text>
                          <Text style={styles.sessionItemPoints}>+{item.quantity * item.pointsPerItem}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {latestSession.qrPayload ? (
                    <View style={styles.qrWrap}>
                      <QRCode value={latestSession.qrPayload} size={132} backgroundColor="#FFFFFF" />
                      <Text style={styles.qrLabel}>Quét để nhận {latestSession.totalPoints} điểm</Text>
                    </View>
                  ) : (
                    <View style={styles.qrPending}>
                      <Text style={styles.qrPendingText}>
                        {latestSession.finalizationMode === 'manual'
                          ? 'Phiên Demo-Day đang chờ người vận hành nhấn F để tạo QR.'
                          : 'QR sẽ được tạo sau 10 giây không có vật phẩm mới.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </SectionCard>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dashboardBg },
  main: { flex: 1 },
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
  feedColumn: { flex: 1 },
  feedEmpty: { padding: 24, textAlign: 'center', color: Colors.textMuted },
  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  feedCount: { fontSize: 11, color: Colors.textMuted },
  feedComplete: { fontSize: 11, color: Colors.textMuted },
  loadMoreButton: { minWidth: 104, minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 6, backgroundColor: Colors.primary },
  loadMoreText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textWhite },
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

  // Recycling session
  sessionCollecting: { fontSize: 12, fontWeight: '600' as const, color: '#F59E0B' },
  sessionComplete: { fontSize: 12, fontWeight: '600' as const, color: '#10B981' },
  emptySession: { fontSize: 13, color: Colors.textMuted },
  sessionContent: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  sessionContentCompact: { flexDirection: 'column' },
  sessionSummary: { flex: 1, gap: 14 },
  sessionMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  sessionMetaLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sessionCode: { marginTop: 3, fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
  sessionMetaValue: { marginTop: 3, fontSize: 14, fontWeight: '600' as const, color: Colors.textPrimary },
  sessionTotal: { marginTop: 3, fontSize: 20, fontWeight: '700' as const, color: '#0F766E' },
  sessionPoints: { marginTop: 3, fontSize: 20, fontWeight: '700' as const, color: '#8B5CF6' },
  sessionItems: { borderTopWidth: 1, borderTopColor: Colors.tableBorder },
  sessionItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.tableBorder },
  sessionItemName: { flex: 1, fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
  sessionItemDetail: { flex: 2, fontSize: 11, color: Colors.textSecondary },
  sessionItemPoints: { width: 42, textAlign: 'right', fontSize: 12, fontWeight: '700' as const, color: '#8B5CF6' },
  qrWrap: { width: 180, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10 },
  qrLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary, textAlign: 'center' },
  qrPending: { width: 180, minHeight: 156, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FFFBEB', borderRadius: 10 },
  qrPendingText: { fontSize: 12, lineHeight: 18, color: '#92400E', textAlign: 'center' },

  // Charts
  axisText: { fontSize: 11, color: Colors.textMuted },
  trendChartArea: { position: 'relative', minHeight: 190 },
  materialLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  materialLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  materialLegendDot: { width: 8, height: 8, borderRadius: 4 },
  materialLegendText: { fontSize: 11, color: Colors.textSecondary },
  rangeLoading: {
    position: 'absolute',
    top: 78,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  rangeLoadingText: { fontSize: 11, fontWeight: '600' as const, color: Colors.primary },
  exportNotice: { backgroundColor: Colors.successBg, paddingHorizontal: 18, paddingVertical: 8 },
  exportNoticeText: { color: Colors.primary, fontSize: 12, fontWeight: '600' as const },

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
