/**
 * GreenGuard Dashboard — Page 1: Dashboard
 * Pixel-perfect recreation of Figma Dashboard screen.
 */
import React, { memo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { AlertTriangle, WifiOff, Wrench, ChevronRight } from 'lucide-react-native';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { KPICard } from '@/components/KPICard';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/theme/colors';
import { DashboardRoute } from '@/types/dashboard.types';
import {
  DASHBOARD_KPI, CLASSIFICATION_TREND, WASTE_SLICES, WASTE_TOTAL_KG,
  COMPARTMENTS, RECENT_CLASSIFICATIONS, SMART_BIN_ROWS,
  CAMPAIGN_STAT, ALERT_CARDS,
} from '@/constants/mockData';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;
const CONTENT_W = SW - SIDEBAR_W;

interface Props {
  onNavigate: (route: DashboardRoute) => void;
}

import { PieChart } from 'react-native-gifted-charts';

// ─── Mini Pie (Waste Type) ────────────────────────────────────────────────────
const WastePie = memo(() => {
  const pieData = WASTE_SLICES.map(s => ({
    value: s.percentage,
    color: s.color,
  }));

  return (
    <View style={pieStyles.wrap}>
      <View style={pieStyles.chartWrap}>
        <PieChart
          donut
          innerRadius={32}
          radius={50}
          data={pieData}
          centerLabelComponent={() => (
            <View style={pieStyles.center}>
              <Text style={pieStyles.centerNum}>{WASTE_TOTAL_KG}</Text>
              <Text style={pieStyles.centerUnit}>kg</Text>
            </View>
          )}
        />
      </View>
      {/* Legend */}
      <View style={pieStyles.legend}>
        {WASTE_SLICES.map(s => (
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
  legendLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  legendPct: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
});

// ─── Compartment Utilization ──────────────────────────────────────────────────
const CompartmentBar = memo(({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={compStyles.row}>
    <Text style={compStyles.label}>{label}</Text>
    <View style={compStyles.barBg}>
      <View style={[compStyles.barFill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
    <Text style={compStyles.pct}>{value}%</Text>
  </View>
));

const compStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { width: 72, fontSize: 12, color: Colors.textSecondary },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.tableBorder, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pct: { width: 34, fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary, textAlign: 'right' },
});

// ─── Fill Level Bar ───────────────────────────────────────────────────────────
const FillBar = memo(({ value }: { value: number }) => {
  const color = value >= 80 ? Colors.binNearlyFull : value >= 50 ? Colors.kpiGreen : Colors.binOnline;
  return (
    <View style={fillStyles.track}>
      <View style={[fillStyles.fill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
  );
});
const fillStyles = StyleSheet.create({
  track: { width: 60, height: 5, backgroundColor: Colors.tableBorder, borderRadius: 3 },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Main Dashboard Screen ────────────────────────────────────────────────────
export default function DashboardScreen({ onNavigate }: Props) {
  const barData = CLASSIFICATION_TREND.map(p => ({
    value: p.value,
    label: p.label,
    frontColor: Colors.chartBar,
  }));

  const alertIcons: Record<string, typeof AlertTriangle> = {
    warning: AlertTriangle,
    error: WifiOff,
    info: Wrench,
  };
  const alertColors: Record<string, string> = {
    warning: Colors.warning,
    error: Colors.error,
    info: Colors.info,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="dashboard" onNavigate={onNavigate} />

      {/* Content area */}
      <View style={styles.main}>
        <DashboardTopNav
          title="Dashboard"
          subtitle="Welcome back, Mark"
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI Row ───────────────────────────────────────────────── */}
          <View style={styles.kpiRow}>
            {DASHBOARD_KPI.map(kpi => (
              <KPICard key={kpi.id} data={kpi} />
            ))}
          </View>

          {/* ── Row 2: Classification Trend + Compartment/Pie ─────────── */}
          <View style={styles.row2}>
            {/* Classification Trend */}
            <SectionCard
              title="Classification Trend"
              style={styles.trendCard}
              rightElement={
                <View style={styles.filterRow}>
                  <TouchableOpacity style={styles.filterBtnActive}>
                    <Text style={styles.filterTextActive}>This Year</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterBtn}>
                    <Text style={styles.filterText}>Last Year</Text>
                  </TouchableOpacity>
                </View>
              }
            >
              <BarChart
                data={barData}
                barWidth={14}
                spacing={8}
                roundedTop
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                noOfSections={4}
                maxValue={1200}
                height={120}
                barBorderRadius={3}
                hideRules={false}
                rulesColor={Colors.dashboardBorder}
                rulesThickness={1}
                initialSpacing={8}
                endSpacing={8}
                width={CONTENT_W - 30 - 28 - (CONTENT_W * 0.36) - 32}
              />
            </SectionCard>

            {/* Right column: Compartment + Waste Pie */}
            <View style={styles.rightCol}>
              <SectionCard
                title="Compartment Utilization"
                style={styles.compartmentCard}
                rightElement={
                  <TouchableOpacity><Text style={styles.allFilters}>All Bins ›</Text></TouchableOpacity>
                }
              >
                {COMPARTMENTS.map(c => (
                  <CompartmentBar key={c.label} label={c.label} value={c.value} color={c.color} />
                ))}
              </SectionCard>

              <SectionCard title="Waste Type" style={styles.pieCard}>
                <WastePie />
              </SectionCard>
            </View>
          </View>

          {/* ── Row 3: Recent Classifications + Smart Bin Status ──────── */}
          <View style={styles.row3}>
            {/* Recent Classifications */}
            <SectionCard
              title="Recent Classifications"
              rightLabel="View all ›"
              style={styles.tableCard}
              noPadding
            >
              {/* Table header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                {['Waste Type','Bin ID','Time','User','Confidence'].map(h => (
                  <Text key={h} style={[styles.tableCell, styles.tableHeaderText]}>{h}</Text>
                ))}
              </View>
              {RECENT_CLASSIFICATIONS.map((r, i) => (
                <View key={r.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <View style={[styles.tableCell, styles.row]}>
                    <View style={[styles.typeDot, { backgroundColor: r.wasteColor }]} />
                    <Text style={styles.tableCellText}>{r.wasteType}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.tableCellText]}>{r.binId}</Text>
                  <Text style={[styles.tableCell, styles.tableCellText, styles.textSm]}>{r.time}</Text>
                  <Text style={[styles.tableCell, styles.tableCellText]}>{r.user}</Text>
                  <Text style={[styles.tableCell, styles.tableCellText,
                    r.confidenceLevel === 'high' ? styles.highConf : styles.medConf
                  ]}>{r.confidence}</Text>
                </View>
              ))}
            </SectionCard>

            {/* Smart Bin Status */}
            <SectionCard
              title="Smart Bin Status"
              rightLabel="View all ›"
              style={styles.binCard}
              noPadding
            >
              {SMART_BIN_ROWS.slice(0, 5).map((b, i) => (
                <View key={b.binId} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.tableCellBold, { flex: 0.8 }]}>{b.binId}</Text>
                  <View style={[styles.tableCell, { flex: 1 }]}><StatusBadge status={b.status} /></View>
                  <View style={[styles.tableCell, styles.row, { flex: 1.5, gap: 5 }]}>
                    <FillBar value={b.fillLevel} />
                  </View>
                  <Text style={[styles.tableCell, styles.tableCellText, { flex: 0.8, textAlign: 'right' }]}>{b.lastUpdate}</Text>
                </View>
              ))}
            </SectionCard>
          </View>

          {/* ── Campaign Performance ──────────────────────────────────── */}
          <SectionCard title="Campaign Performance" style={styles.campaignCard}>
            <View style={styles.campaignInner}>
              <View style={styles.campCol}>
                <Text style={styles.campaignName}>Green&amp;Clean with Con Cung</Text>
                <View style={styles.campStatsRow}>
                  {[
                    { label: 'Participants', value: '12,421' },
                    { label: 'Collected',    value: '8,241'  },
                    { label: 'Recycled',     value: '66.2%'  },
                  ].map(s => (
                    <View key={s.label} style={styles.campStat}>
                      <Text style={styles.campStatNum}>{s.value}</Text>
                      <Text style={styles.campStatLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.campColRight}>
                <View style={styles.campChart}>
                  <BarChart
                    data={CAMPAIGN_STAT.trend.map(p => ({
                      value: p.value,
                      label: p.label,
                      frontColor: Colors.chartBar,
                    }))}
                    barWidth={10}
                    spacing={6}
                    roundedTop
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisTextStyle={styles.axisText}
                    xAxisLabelTextStyle={styles.axisTextTiny}
                    noOfSections={3}
                    height={60}
                    barBorderRadius={2}
                    rulesColor={Colors.dashboardBorder}
                    width={140}
                    initialSpacing={4}
                    endSpacing={4}
                  />
                </View>
              </View>
            </View>
          </SectionCard>

          {/* ── Alert Cards ────────────────────────────────────────────── */}
          <View style={styles.alertRow}>
            {ALERT_CARDS.map(alert => {
              const Icon = alertIcons[alert.severity];
              const color = alertColors[alert.severity];
              return (
                <View key={alert.id} style={[styles.alertCard]}>
                  <View style={styles.alertIcon}><Icon size={18} color={color} /></View>
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertTitle, { color }]}>{alert.title}</Text>
                    <Text style={styles.alertMsg}>{alert.message}</Text>
                  </View>
                  <Text style={styles.alertTime}>Just now</Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dashboardBg },
  main: { flex: 1, marginLeft: SIDEBAR_W },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 10 },

  // Row 2
  row2: { flexDirection: 'row', gap: 10 },
  trendCard: { flex: 1.6 },
  rightCol: { flex: 1, gap: 10 },
  compartmentCard: { flex: 1 },
  pieCard: {},

  // Row 3
  row3: { flexDirection: 'row', gap: 10 },
  tableCard: { flex: 1.2 },
  binCard: { flex: 1 },

  // Table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.tableBorder,
  },
  tableHeader: { backgroundColor: Colors.tableHeader },
  tableRowAlt: { backgroundColor: Colors.tableRowAlt },
  tableCell: { flex: 1 },
  tableCellWide: { flex: 1.5 },
  tableHeaderText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableCellText: { fontSize: 12, color: Colors.textSecondary },
  tableCellBold: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
  textSm: { fontSize: 11 },
  cellRight: { textAlign: 'right' },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  highConf: { color: Colors.kpiGreen },
  medConf: { color: Colors.kpiOrange },

  // Campaign
  campCol: { flex: 1 },
  campColRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 10 },
  campaignName: { fontSize: 14, fontWeight: '600' as const, color: Colors.textPrimary, marginBottom: 12 },
  campStatsRow: { flexDirection: 'row', gap: 20 },
  campStat: {},
  campStatNum: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  campStatLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  campChart: { width: 140, height: 60, alignItems: 'center', justifyContent: 'center' },
  campaignCard: {},
  campaignInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },

  // Alerts
  alertRow: { flexDirection: 'row', gap: 10 },
  alertCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dashboardCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dashboardBorder,
    padding: 10,
  },
  alertIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.kpiRedBg, alignItems: 'center', justifyContent: 'center' },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '600' as const },
  alertMsg: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  alertTime: { fontSize: 11, color: Colors.textMuted },

  // Charts
  axisText: { fontSize: 11, color: Colors.textMuted },
  axisTextTiny: { fontSize: 10, color: Colors.textMuted },
  chartWrap: { paddingRight: 10, paddingTop: 10 },

  // Misc
  filterRow: { flexDirection: 'row', gap: 4 },
  filterBtn: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    borderWidth: 1, borderColor: Colors.dashboardBorder,
  },
  filterBtnActive: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  filterText: { fontSize: 10, color: Colors.textMuted },
  filterTextActive: { fontSize: 10, color: '#fff', fontWeight: '600' as const },
  allFilters: { fontSize: 10, color: Colors.primary },
});
