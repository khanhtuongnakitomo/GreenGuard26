/**
 * GreenGuard Dashboard — Page 2: Analytics
 */
import React, { memo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { KPICard } from '@/components/KPICard';
import { SectionCard } from '@/components/SectionCard';
import { Colors } from '@/theme/colors';
import { DashboardRoute } from '@/types/dashboard.types';
import {
  ANALYTICS_KPI, CLASSIFICATION_TREND, WASTE_SLICES, WASTE_TOTAL_KG,
  ACCURACY_TREND, PEAK_USAGE, TOP_LOCATIONS, DAILY_AVERAGE, WASTE_DISTRIBUTION,
} from '@/constants/mockData';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;
const CONTENT_W = SW - SIDEBAR_W;

interface Props { onNavigate: (route: DashboardRoute) => void; }

import { PieChart } from 'react-native-gifted-charts';

// ─── Waste Pie (same as dashboard) ───────────────────────────────────────────
const WastePie = memo(() => {
  const pieData = WASTE_SLICES.map(s => ({
    value: s.percentage,
    color: s.color,
  }));

  return (
    <View style={pieS.wrap}>
      <View style={pieS.chartWrap}>
        <PieChart
          donut
          innerRadius={32}
          radius={50}
          data={pieData}
          centerLabelComponent={() => (
            <View style={pieS.center}>
              <Text style={pieS.centerNum}>{WASTE_TOTAL_KG}</Text>
              <Text style={pieS.centerUnit}>kg</Text>
            </View>
          )}
        />
      </View>
      <View style={pieS.legend}>
        {WASTE_SLICES.map(s => (
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
  const barData = CLASSIFICATION_TREND.map(p => ({
    value: p.value, label: p.label, frontColor: Colors.chartBar,
  }));

  const accuracyData = ACCURACY_TREND.map(p => ({
    value: p.value, dataPointColor: Colors.chartLine,
    dataPointRadius: 3,
  }));

  const peakData = PEAK_USAGE.map(p => ({
    value: p.value, label: p.label, frontColor: Colors.chartBar,
  }));

  const distData = WASTE_DISTRIBUTION.map(p => ({
    value: p.value, dataPointColor: Colors.chartLine, dataPointRadius: 3,
  }));

  const halfW = (CONTENT_W - 16 * 3) / 2;
  const thirdW = (CONTENT_W - 16 * 4) / 3;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="analytics" onNavigate={onNavigate} />
      <View style={S.main}>
        <DashboardTopNav title="Analytics" subtitle="Welcome back, Mark" />

        <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
          {/* KPI Row */}
          <View style={S.kpiRow}>
            {ANALYTICS_KPI.map(kpi => <KPICard key={kpi.id} data={kpi} />)}
          </View>

          {/* Row 2: Classification Trend + Waste Pie */}
          <View style={S.row}>
            <SectionCard
              title="Classification Trend"
              style={{ flex: 1.5 }}
              rightElement={
                <View style={S.filterRow}>
                  <TouchableOpacity style={S.filterBtnActive}><Text style={S.filterActive}>This Week</Text></TouchableOpacity>
                  <TouchableOpacity style={S.filterBtn}><Text style={S.filterInactive}>Apr 07 2025</Text></TouchableOpacity>
                  <TouchableOpacity style={S.filterBtn}><Text style={S.filterInactive}>Apr 14</Text></TouchableOpacity>
                </View>
              }
            >
              <BarChart
                data={barData}
                barWidth={14} spacing={8} roundedTop
                xAxisThickness={0} yAxisThickness={0}
                yAxisTextStyle={S.axisText}
                xAxisLabelTextStyle={S.axisText}
                noOfSections={4} maxValue={1200} height={120}
                barBorderRadius={3} rulesColor={Colors.dashboardBorder}
                width={halfW - 32}
                initialSpacing={8} endSpacing={8}
              />
            </SectionCard>

            <SectionCard title="Classification by Waste Type" style={{ flex: 1 }}>
              <WastePie />
            </SectionCard>
          </View>

          {/* Row 3: Accuracy Trend + Peak Usage + Top Locations */}
          <View style={S.row}>
            <SectionCard title="Accuracy Trend" style={{ flex: 1 }}>
              <LineChart
                data={accuracyData}
                height={100} width={thirdW - 32}
                color={Colors.chartLine}
                thickness={2}
                dataPointsColor={Colors.chartLine}
                xAxisThickness={0} yAxisThickness={0}
                yAxisTextStyle={S.axisText}
                noOfSections={4} maxValue={100}
                rulesColor={Colors.dashboardBorder}
                startFillColor={Colors.chartLineArea}
                endFillColor={Colors.transparent}
                areaChart
                initialSpacing={10} endSpacing={10}
              />
            </SectionCard>

            <SectionCard title="Peak Usage" style={{ flex: 1 }}>
              <BarChart
                data={peakData}
                barWidth={10} spacing={4} roundedTop
                xAxisThickness={0} yAxisThickness={0}
                xAxisLabelTextStyle={{ fontSize: 8, color: Colors.textMuted }}
                yAxisTextStyle={S.axisText}
                noOfSections={4} height={100}
                barBorderRadius={2} rulesColor={Colors.dashboardBorder}
                width={thirdW - 32} frontColor={Colors.chartBar}
                initialSpacing={4} endSpacing={4}
              />
            </SectionCard>

            <SectionCard title="Top Locations" style={{ flex: 1 }}>
              {TOP_LOCATIONS.map((loc, i) => (
                <View key={i} style={S.locRow}>
                  <View style={S.locDot} />
                  <Text style={S.locName}>{loc.name}</Text>
                  <Text style={S.locVal}>{loc.amount} {loc.unit}</Text>
                </View>
              ))}
            </SectionCard>
          </View>

          {/* Row 4: Waste Distribution + Daily Average */}
          <View style={S.row}>
            <SectionCard title="Waste Type Distribution Over Time" style={{ flex: 2 }}>
              <LineChart
                data={distData}
                height={100} width={(CONTENT_W - 16 * 3) * 2 / 3 - 32}
                color={Colors.chartLine}
                thickness={2}
                xAxisThickness={0} yAxisThickness={0}
                yAxisTextStyle={S.axisText}
                noOfSections={4}
                rulesColor={Colors.dashboardBorder}
                startFillColor={Colors.chartLineArea}
                endFillColor={Colors.transparent}
                areaChart
                initialSpacing={10} endSpacing={10}
              />
            </SectionCard>

            <SectionCard title="Daily Average" style={{ flex: 1 }}>
              {DAILY_AVERAGE.map(d => (
                <View key={d.label} style={S.avgRow}>
                  <View style={[S.avgDot, { backgroundColor: d.color }]} />
                  <Text style={S.avgLabel}>{d.label}</Text>
                  <Text style={S.avgPct}>{d.percentage}%</Text>
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

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dashboardBg },
  main: { flex: 1, marginLeft: SIDEBAR_W },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  filterRow: { flexDirection: 'row', gap: 4 },
  filterBtn: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: Colors.dashboardBorder },
  filterBtnActive: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: Colors.primary },
  filterInactive: { fontSize: 11, color: Colors.textMuted },
  filterActive: { fontSize: 11, color: '#fff', fontWeight: '600' as const },
  axisText: { fontSize: 11, color: Colors.textMuted },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  locDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.chartBar },
  locName: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  locVal: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  avgDot: { width: 8, height: 8, borderRadius: 4 },
  avgLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  avgPct: { fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
});
