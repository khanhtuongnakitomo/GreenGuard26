/**
 * GreenGuard Dashboard — Page 2: Analytics
 * Connected with live Quality metrics & 3-Class material aggregates
 */
import React, { memo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { KPICard } from '@/components/KPICard';
import { SectionCard } from '@/components/SectionCard';
import { Colors } from '@/theme/colors';
import { DashboardRoute, KPICardData } from '@/types/dashboard.types';
import { DEMO_MODE } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { analyticsQuery } from '@/services/dashboardQueries';
import { DataStatus } from '@/components/DataStatus';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;
const CONTENT_W = SW - SIDEBAR_W;

interface Props {
  onNavigate: (route: DashboardRoute) => void;
}

// ─── Waste Pie ───────────────────────────────────────────────────────────────
const WastePie = memo(({ waste }: { waste: { pet_clean: number; pet_bad: number; aluminum: number } }) => {
  const total = Math.max(1, waste.pet_clean + waste.pet_bad + waste.aluminum);
  const cleanPct = Math.round((waste.pet_clean / total) * 100);
  const badPct = Math.round((waste.pet_bad / total) * 100);
  const alumPct = waste.pet_clean + waste.pet_bad + waste.aluminum === 0 ? 0 : Math.max(0, 100 - cleanPct - badPct);

  const slices = [
    { label: 'PET Sạch', percentage: cleanPct, color: '#10B981' },
    { label: 'PET Còn nắp/nhãn', percentage: badPct, color: '#F59E0B' },
    { label: 'Lon nhôm', percentage: alumPct, color: '#06B6D4' },
  ];

  const pieData = slices.map((s) => ({
    value: s.percentage,
    color: s.color,
  }));

  const totalKg = Number(((waste.pet_clean * 0.022) + (waste.pet_bad * 0.024) + (waste.aluminum * 0.015)).toFixed(1));

  return (
    <View style={pieS.wrap}>
      <View style={pieS.chartWrap}>
        {waste.pet_clean + waste.pet_bad + waste.aluminum > 0 ? (
        <PieChart
          donut
          innerRadius={32}
          radius={50}
          data={pieData.length > 0 ? pieData : [{ value: 100, color: '#10B981' }]}
          centerLabelComponent={() => (
            <View style={pieS.center}>
              <Text style={pieS.centerNum}>{totalKg}</Text>
              <Text style={pieS.centerUnit}>kg</Text>
            </View>
          )}
        />
        ) : <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Chưa có dữ liệu</Text>}
      </View>
      <View style={pieS.legend}>
        {slices.map((s) => (
          <View key={s.label} style={pieS.item}>
            <View style={[pieS.dot, { backgroundColor: s.color }]} />
            <Text style={pieS.itemLabel}>{s.label}</Text>
            <Text style={pieS.itemPct}>{s.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const pieS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartWrap: { width: 100, height: 100 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerNum: { fontSize: 15, fontWeight: '700' as const, color: Colors.textPrimary },
  centerUnit: { fontSize: 11, color: Colors.textMuted, marginTop: -2 },
  legend: { flex: 1, gap: 5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  itemLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  itemPct: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
});

export default function AnalyticsScreen({ onNavigate }: Props) {
  const snapshot = useQuery(analyticsQuery());
  if (!snapshot.data) return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="analytics" onNavigate={onNavigate} />
      <View style={S.main}>
        <DashboardTopNav title="Phân tích chuyên sâu (Analytics)" subtitle="Dữ liệu trực tiếp" />
        <DataStatus demo={false} error={snapshot.isError} />
      </View>
    </SafeAreaView>
  );
  const { overview, quality } = snapshot.data;

  const kpis: KPICardData[] = [
    {
      id: 'ak1',
      label: 'Tổng nhận diện',
      value: `${overview.todayDetections}`,
      subLabel: `${overview?.wasteBreakdown?.pet_clean ?? 0} PET Sạch`,
      iconType: 'trash',
      iconColor: Colors.kpiGreen,
      iconBg: Colors.kpiGreenBg,
    },
    {
      id: 'ak2',
      label: 'Độ chuẩn phân loại (Purity)',
      value: overview.purityRate == null ? '—' : `${overview.purityRate}%`,
      subLabel: 'Mục tiêu: > 90%',
      iconType: 'accuracy',
      iconColor: Colors.kpiBlue,
      iconBg: Colors.kpiBlueBg,
    },
    {
      id: 'ak3',
      label: 'Độ trễ P50 / P95',
      value: `${quality.latencyP50 == null ? '—' : quality.latencyP50 + 'ms'} / ${quality.latencyP95 == null ? '—' : quality.latencyP95 + 'ms'}`,
      subLabel: 'Mục tiêu: < 50ms',
      iconType: 'weight',
      iconColor: Colors.kpiOrange,
      iconBg: Colors.kpiOrangeBg,
    },
    {
      id: 'ak4',
      label: 'AI FPS Trung bình',
      value: overview.avgFps == null ? '—' : `${overview.avgFps} FPS`,
      subLabel: 'Hiệu năng từ dữ liệu nhận diện',
      iconType: 'wifi',
      iconColor: Colors.kpiGreen,
      iconBg: Colors.kpiGreenBg,
    },
  ];

  const trendData = overview.classificationTrend.map(p => ({ ...p, frontColor: Colors.chartBar }));
  const confidenceHistData = quality.confidenceHistogram.map(b => ({ value: b.count, label: b.bucket, frontColor: '#10B981' }));
  const waste = overview.wasteBreakdown;
  const halfW = (CONTENT_W - 16 * 3) / 2;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="analytics" onNavigate={onNavigate} />
      <View style={S.main}>
        <DashboardTopNav title="Phân tích chuyên sâu (Analytics)" subtitle="Hiệu năng Model AI & Chỉ số nguyên vật liệu" />

        <DataStatus demo={DEMO_MODE} error={snapshot.isError} updatedAt={snapshot.dataUpdatedAt} />
        <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
          {/* KPI Row */}
          <View style={S.kpiRow}>
            {kpis.map((kpi) => (
              <KPICard key={kpi.id} data={kpi} />
            ))}
          </View>

          {/* Row 2: Classification Trend + Waste Pie */}
          <View style={S.row}>
            <SectionCard title="Số lượng nhận diện theo thời gian" style={{ flex: 1.5 }}>
              <BarChart
                data={trendData}
                barWidth={14}
                spacing={12}
                roundedTop
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={S.axisText}
                xAxisLabelTextStyle={S.axisText}
                noOfSections={4}
                height={120}
                barBorderRadius={3}
                rulesColor={Colors.dashboardBorder}
                width={halfW - 32}
                initialSpacing={8}
                endSpacing={8}
              />
            </SectionCard>

            <SectionCard title="Phân loại 3 nhóm vật liệu" style={{ flex: 1 }}>
              <WastePie waste={waste} />
            </SectionCard>
          </View>

          {/* Row 3: Confidence Distribution & Quality */}
          <View style={S.row}>
            <SectionCard title="Phân bổ độ tin cậy AI (Confidence Histogram)" style={{ flex: 1 }}>
              <BarChart
                data={confidenceHistData}
                barWidth={18}
                spacing={16}
                roundedTop
                xAxisThickness={0}
                yAxisThickness={0}
                xAxisLabelTextStyle={{ fontSize: 9, color: Colors.textMuted }}
                yAxisTextStyle={S.axisText}
                noOfSections={4}
                height={100}
                barBorderRadius={3}
                rulesColor={Colors.dashboardBorder}
                width={halfW - 32}
                initialSpacing={12}
                endSpacing={12}
              />
            </SectionCard>

            <SectionCard title="Tỷ lệ đạt chuẩn phân loại (Purity Rate)" style={{ flex: 1 }}>
              <View style={{ paddingVertical: 10, gap: 10 }}>
                <View style={S.avgRow}>
                  <View style={[S.avgDot, { backgroundColor: '#10B981' }]} />
                  <Text style={S.avgLabel}>PET Sạch (Đạt chuẩn 100% tái chế):</Text>
                  <Text style={S.avgPct}>{waste.pet_clean} items</Text>
                </View>
                <View style={S.avgRow}>
                  <View style={[S.avgDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={S.avgLabel}>PET Còn nắp/nhãn (Cần xử lý thêm):</Text>
                  <Text style={S.avgPct}>{waste.pet_bad} items</Text>
                </View>
                <View style={S.avgRow}>
                  <View style={[S.avgDot, { backgroundColor: '#06B6D4' }]} />
                  <Text style={S.avgLabel}>Lon nhôm (Kim loại):</Text>
                  <Text style={S.avgPct}>{waste.aluminum} items</Text>
                </View>
              </View>
            </SectionCard>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dashboardBg },
  main: { flex: 1, marginLeft: SIDEBAR_W },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  axisText: { fontSize: 10, color: Colors.textMuted },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avgDot: { width: 9, height: 9, borderRadius: 5 },
  avgLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  avgPct: { fontSize: 13, fontWeight: '700' as const, color: Colors.textPrimary },
});
