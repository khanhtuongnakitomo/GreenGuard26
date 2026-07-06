/**
 * GreenGuard Dashboard — Page 3: Smart Bins
 */
import React, { memo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Cpu, Zap, Settings2, Brain, Plus } from 'lucide-react-native';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/theme/colors';
import { DashboardRoute, SmartBin, BinStatus } from '@/types/dashboard.types';
import { SMART_BINS, BIN_OVERVIEW, SMART_BIN_ROWS } from '@/constants/mockData';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;
const CONTENT_W = SW - SIDEBAR_W;

interface Props { onNavigate: (route: DashboardRoute) => void; }

// ─── Bin Map Placeholder ──────────────────────────────────────────────────────
const BinMapView = memo(({ bins, selectedBin }: { bins: typeof SMART_BINS; selectedBin: SmartBin | null }) => {
  const statusColor: Record<BinStatus, string> = {
    'Online': Colors.binOnline,
    'Offline': Colors.binOffline,
    'Error': Colors.binError,
    'Nearly Full': Colors.binNearlyFull,
  };
  return (
    <View style={mapS.container}>
      {/* Map background */}
      <View style={mapS.mapBg}>
        {/* Grid lines */}
        {[0.25,0.5,0.75].map(r => (
          <View key={`h${r}`} style={[mapS.hLine, { top: `${r * 100}%` as any }]} />
        ))}
        {[0.25,0.5,0.75].map(c => (
          <View key={`v${c}`} style={[mapS.vLine, { left: `${c * 100}%` as any }]} />
        ))}
        {/* Bin markers */}
        {bins.map((bin, i) => {
          // Approximate positioning: normalize lat/lng to box
          const lats = bins.map(b => b.coordinates.lat);
          const lngs = bins.map(b => b.coordinates.lng);
          const minLat = Math.min(...lats), maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
          const padding = 0.15;
          const x = ((bin.coordinates.lng - minLng) / (maxLng - minLng || 1)) * (1 - padding * 2) + padding;
          const y = (1 - (bin.coordinates.lat - minLat) / (maxLat - minLat || 1)) * (1 - padding * 2) + padding;
          const isSelected = selectedBin?.binId === bin.binId;
          return (
            <View
              key={bin.binId}
              style={[
                mapS.marker,
                { left: `${x * 100}%` as any, top: `${y * 100}%` as any,
                  backgroundColor: statusColor[bin.status],
                  transform: [{ scale: isSelected ? 1.3 : 1 }],
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected ? '#fff' : 'transparent',
                }
              ]}
            >
              <Text style={mapS.markerLabel}>{bin.binId}</Text>
            </View>
          );
        })}
      </View>
      <Text style={mapS.mapLabel}>Ho Chi Minh City, Vietnam</Text>
    </View>
  );
});

const mapS = StyleSheet.create({
  container: { flex: 1, minHeight: 220, borderRadius: 8, overflow: 'hidden' },
  mapBg: {
    flex: 1, backgroundColor: '#E8F4E8', borderRadius: 8,
    position: 'relative', minHeight: 220,
  },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#C8E6C9' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#C8E6C9' },
  marker: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -14, marginTop: -14,
  },
  markerPoint: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.kpiGreen, borderWidth: 2, borderColor: '#fff' },
  markerLabelWrap: { backgroundColor: Colors.dashboardCard, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: Colors.dashboardBorder },
  markerLabel: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  mapLabel: { position: 'absolute', bottom: 6, left: 8, fontSize: 11, color: Colors.textMuted },
});

// ─── Overview Donut ───────────────────────────────────────────────────────────
const OverviewDonut = memo(({ count, label, color }: {
  count: number; label: string; color: string; total: number;
}) => {
  return (
    <View style={donutS.wrap}>
      <View style={[donutS.outer, { borderColor: color }]}>
        <View style={donutS.statValue}>
          <Text style={donutS.num}>{count}</Text>
        </View>
      </View>
      <Text style={[donutS.label, { color }]}>{label}</Text>
    </View>
  );
});

const donutS = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  outer: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dashboardCard,
  },
  statValue: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 2 },
  num: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary },
  label: { fontSize: 12, fontWeight: '600' as const },
});

// ─── Hardware Row ─────────────────────────────────────────────────────────────
const HardwareItem = memo(({ Icon, label, ok }: {
  Icon: React.ComponentType<{ size: number; color: string }>; label: string; ok: boolean;
}) => (
  <View style={hwS.item}>
    <View style={[hwS.iconWrap, { backgroundColor: ok ? Colors.kpiGreenBg : Colors.kpiRedBg }]}>
      <Icon size={18} color={ok ? Colors.kpiGreen : Colors.kpiRed} />
    </View>
    <Text style={hwS.label}>{label}</Text>
    <View style={[hwS.badge, { backgroundColor: ok ? Colors.kpiGreenBg : Colors.kpiRedBg }]}>
      <Text style={[hwS.badgeText, { color: ok ? Colors.kpiGreen : Colors.kpiRed }]}>
        {ok ? 'OK' : 'Error'}
      </Text>
    </View>
  </View>
));

const hwS = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 6 },
  iconWrap: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },
});

// ─── Fill Bar ─────────────────────────────────────────────────────────────────
const FillBar = memo(({ value }: { value: number }) => {
  const color = value >= 80 ? Colors.binNearlyFull : Colors.binOnline;
  return (
    <View style={fbS.track}>
      <View style={[fbS.fill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
  );
});
const fbS = StyleSheet.create({
  track: { width: 60, height: 5, backgroundColor: Colors.tableBorder, borderRadius: 3 },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SmartBinsScreen({ onNavigate }: Props) {
  const [selectedBin, setSelectedBin] = useState<SmartBin>(SMART_BINS[0]);

  const hw = selectedBin.hardware;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="smartbins" onNavigate={onNavigate} />
      <View style={S.main}>
        <DashboardTopNav title="Smart Bins" subtitle="Welcome back, Mark" />

        <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
          {/* ── Top: Map + Right Panel ─────────────────────────────── */}
          <View style={S.topRow}>
            {/* Map */}
            <SectionCard title="Bin Map" style={S.mapCard} noPadding>
              <View style={{ padding: 12, flex: 1 }}>
                <BinMapView bins={SMART_BINS} selectedBin={selectedBin} />
              </View>
            </SectionCard>

            {/* Right: Overview + Table */}
            <View style={S.rightPanel}>
              {/* Bin Overview donuts */}
              <SectionCard title="Bin Overview" style={S.overviewCard}>
                <View style={S.donutRow}>
                  {BIN_OVERVIEW.map(o => (
                    <OverviewDonut key={o.label} count={o.count} label={o.label} color={o.color} total={o.total} />
                  ))}
                </View>
              </SectionCard>

              {/* Status table */}
              <SectionCard title="Bin Status" style={S.statusCard} noPadding>
                {/* Search */}
                <View style={S.searchBar}>
                  <Text style={S.searchPlaceholder}>🔍  Search</Text>
                </View>
                {/* Header */}
                <View style={[S.tableRow, S.tableHeader]}>
                  <Text style={[S.tableCell, S.headerText, { flex: 0.8 }]}>Bin ID</Text>
                  <Text style={[S.tableCell, S.headerText, { flex: 1.2 }]}>Location</Text>
                  <Text style={[S.tableCell, S.headerText, { flex: 1 }]}>Status</Text>
                  <Text style={[S.tableCell, S.headerText, { flex: 1.5 }]}>Fill Level</Text>
                  <Text style={[S.tableCell, S.headerText, { flex: 1 }]}>Last Update</Text>
                </View>
                {/* Rows */}
                {SMART_BIN_ROWS.map((row, i) => (
                  <TouchableOpacity
                    key={row.binId}
                    style={[S.tableRow, i % 2 === 1 && S.rowAlt, selectedBin.binId === row.binId && S.rowSelected]}
                    onPress={() => {
                      const full = SMART_BINS.find(b => b.binId === row.binId);
                      if (full) setSelectedBin(full);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.tableCell, S.cellBold, { flex: 0.8 }]}>{row.binId}</Text>
                    <Text style={[S.tableCell, S.cellText, { flex: 1.2 }]}>{row.location}</Text>
                    <View style={[S.tableCell, { flex: 1 }]}><StatusBadge status={row.status} /></View>
                    <View style={[S.tableCell, S.rowInline, { flex: 1.5 }]}>
                      <FillBar value={row.fillLevel} />
                      <Text style={S.cellText}> {row.fillLevel}%</Text>
                    </View>
                    <Text style={[S.tableCell, S.cellText, { flex: 1 }]}>{row.lastUpdate}</Text>
                  </TouchableOpacity>
                ))}
              </SectionCard>
            </View>
          </View>

          {/* ── Selected Bin Panel ───────────────────────────────────── */}
          <SectionCard
            title={`Selected Bin: ${selectedBin.binId}`}
            style={S.selectedCard}
            rightElement={<StatusBadge status={selectedBin.status} />}
          >
            <View style={S.selectedInner}>
              {/* Fill gauge */}
              <View style={S.fillGauge}>
                <View style={[S.fillOuter, { borderColor: selectedBin.fillLevel >= 80 ? Colors.binNearlyFull : Colors.binOnline }]}>
                  <View style={S.fillValRow}>
                    <Text style={S.fillNum}>{selectedBin.fillLevel}%</Text>
                  </View>
                  <Text style={S.fillSub}>full</Text>
                </View>
                <Text style={S.fillLocation}>{selectedBin.location}</Text>
              </View>

              {/* Hardware status */}
              <View style={S.hwRow}>
                <HardwareItem Icon={Camera}   label="Camera"       ok={hw.camera}      />
                <HardwareItem Icon={Cpu}      label="Jetson Nano"  ok={hw.jetsonNano}  />
                <HardwareItem Icon={Zap}      label="ESP32-S3"     ok={hw.esp32s3}     />
                <HardwareItem Icon={Settings2}label="Servo Motors" ok={hw.servoMotors} />
                <HardwareItem Icon={Brain}    label="AI Model"     ok={hw.aiModel}     />
              </View>
            </View>
          </SectionCard>

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

  topRow: { flexDirection: 'row', gap: 12 },
  mapCard: { flex: 1, minHeight: 340 },
  rightPanel: { flex: 1.2, gap: 12 },
  overviewCard: {},
  donutRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  statusCard: { flex: 1 },

  searchBar: {
    margin: 10, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: Colors.tableHeader,
    borderRadius: 7, borderWidth: 1, borderColor: Colors.dashboardBorder,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, padding: 0 },
  searchPlaceholder: { fontSize: 13, color: Colors.textMuted },
  filterBtn: { padding: 6, borderRadius: 6, backgroundColor: Colors.dashboardCard, borderWidth: 1, borderColor: Colors.dashboardBorder },

  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.tableBorder },
  tableHeader: { backgroundColor: Colors.tableHeader },
  rowAlt: { backgroundColor: Colors.tableRowAlt },
  rowSelected: { backgroundColor: 'rgba(25, 203, 102, 0.05)' },
  tableCell: { flex: 1 },
  headerText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  cellText: { fontSize: 12, color: Colors.textSecondary },
  cellBold: { fontSize: 12, fontWeight: '600' as const, color: Colors.textPrimary },
  rowInline: { flexDirection: 'row', alignItems: 'center' },

  selectedCard: {},
  selectedInner: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  fillGauge: { alignItems: 'center', gap: 6 },
  fillOuter: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dashboardCard,
  },
  fillValRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 8 },
  fillNum: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  fillSub: { fontSize: 11, color: Colors.textMuted },
  fillLocation: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary },
  hwRow: { flex: 1, flexDirection: 'row', gap: 12 },
});
