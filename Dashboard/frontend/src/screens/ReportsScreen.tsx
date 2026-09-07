import { DataStatus } from '@/components/DataStatus';
/**
 * GreenGuard Dashboard — Page 4: Reports
 */
import React, { memo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar, Download, FileText, FileSpreadsheet,
  Search, Eye, Trash2, ChevronDown,
} from 'lucide-react-native';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import { SectionCard } from '@/components/SectionCard';
import { Colors } from '@/theme/colors';
import { DashboardRoute, ReportType } from '@/types/dashboard.types';
import { REPORT_HISTORY } from '@/constants/mockData';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;
const CONTENT_W = SW - SIDEBAR_W;

interface Props { onNavigate: (route: DashboardRoute) => void; }

// ─── Quick Report Card ────────────────────────────────────────────────────────
const QuickReportCard = memo(({ title }: { title: string }) => (
  <View style={qS.card}>
    {/* Icon row */}
    <View style={qS.iconRow}>
      <View style={[qS.iconWrap, { backgroundColor: Colors.errorBg }]}>
        <FileText size={20} color={Colors.error} />
      </View>
    </View>
    <Text style={qS.title}>{title}</Text>
    {/* Calendar button */}
    <TouchableOpacity style={qS.calBtn} activeOpacity={0.8}>
      <Calendar size={12} color={Colors.textMuted} />
      <Text style={qS.calText}>Calendar</Text>
      <ChevronDown size={10} color={Colors.textMuted} />
    </TouchableOpacity>
    {/* Download buttons */}
    <View style={qS.dlRow}>
      <TouchableOpacity style={[qS.dlBtn, { backgroundColor: Colors.errorBg }]} activeOpacity={0.8}>
        <FileText size={11} color={Colors.error} />
        <Text style={[qS.dlText, { color: Colors.error }]}>PDF</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[qS.dlBtn, { backgroundColor: Colors.kpiGreenBg }]} activeOpacity={0.8}>
        <FileSpreadsheet size={11} color={Colors.kpiGreen} />
        <Text style={[qS.dlText, { color: Colors.kpiGreen }]}>Excel</Text>
      </TouchableOpacity>
    </View>
  </View>
));

const qS = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.dashboardCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dashboardBorder,
    padding: 14,
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2,
  },
  iconRow: { flexDirection: 'row' },
  iconWrap: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.textPrimary },
  calBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.dashboardBorder,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5,
  },
  calText: { flex: 1, fontSize: 12, color: Colors.textMuted },
  dlRow: { flexDirection: 'row', gap: 8 },
  dlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 6, borderRadius: 6,
  },
  dlText: { fontSize: 12, fontWeight: '600' as const },
});

// ─── Report Type Badge ────────────────────────────────────────────────────────
const TypeBadge = memo(({ type }: { type: ReportType }) => (
  <View style={[tbS.badge, type === 'PDF' ? tbS.pdf : tbS.excel]}>
    {type === 'PDF'
      ? <FileText size={10} color={Colors.error} />
      : <FileSpreadsheet size={10} color={Colors.kpiGreen} />
    }
    <Text style={[tbS.text, type === 'PDF' ? { color: Colors.error } : { color: Colors.kpiGreen }]}>
      {type}
    </Text>
  </View>
));

const tbS = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  pdf: { backgroundColor: Colors.errorBg },
  excel: { backgroundColor: Colors.kpiGreenBg },
  text: { fontSize: 11, fontWeight: '600' as const },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen({ onNavigate }: Props) {
  const [searchText, setSearchText] = useState('');
  const filtered = REPORT_HISTORY.filter(r =>
    r.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <DashboardSidebar activeRoute="reports" onNavigate={onNavigate} />
      <View style={S.main}>
        <DashboardTopNav title="Reports" subtitle="Welcome back, Mark" />

        <DataStatus demo error={false} />
        <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
          {/* ── Quick Report ────────────────────────────────────────── */}
          <SectionCard
            title="Quick Report"
            style={S.section}
            rightLabel="Generate and download system reports"
          >
            <View style={S.quickRow}>
              {['Daily Report', 'Weekly Report', 'Monthly Report', 'Yearly Report'].map(t => (
                <QuickReportCard key={t} title={t} />
              ))}
            </View>
          </SectionCard>

          {/* ── Report History ──────────────────────────────────────── */}
          <SectionCard
            title="Report History"
            style={S.section}
            noPadding
            rightElement={
              <View style={S.searchWrap}>
                <Search size={12} color={Colors.textMuted} />
                <TextInput
                  style={S.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            }
          >
            {/* Table header */}
            <View style={[S.tableRow, S.tableHeader]}>
              {['Report Name','Type','Period','Created On','Size','Actions'].map(h => (
                <Text key={h} style={[h === 'Report Name' ? S.cellWide : S.tableCell, S.headerText]}>
                  {h}
                </Text>
              ))}
            </View>

            {/* Rows */}
            {filtered.map((r, i) => (
              <View key={r.id} style={[S.tableRow, i % 2 === 1 && S.rowAlt]}>
                <Text style={[S.cellWide, S.cellPrimary]} numberOfLines={1}>{r.name}</Text>
                <View style={S.tableCell}><TypeBadge type={r.type} /></View>
                <Text style={[S.tableCell, S.cellText]} numberOfLines={1}>{r.period}</Text>
                <Text style={[S.tableCell, S.cellText]} numberOfLines={1}>{r.createdAt}</Text>
                <Text style={[S.tableCell, S.cellText]}>{r.size}</Text>
                <View style={[S.tableCell, S.actRow]}>
                  <TouchableOpacity style={S.actBtn} activeOpacity={0.7}>
                    <Download size={13} color={Colors.kpiBlue} />
                  </TouchableOpacity>
                  <TouchableOpacity style={S.actBtn} activeOpacity={0.7}>
                    <Eye size={13} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={S.actBtn} activeOpacity={0.7}>
                    <Trash2 size={13} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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
  section: {},
  quickRow: { flexDirection: 'row', gap: 12 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: Colors.dashboardBorder,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: Colors.tableHeader,
  },
  searchInput: { fontSize: 13, color: Colors.textPrimary, minWidth: 140 },

  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.tableBorder },
  tableHeader: { backgroundColor: Colors.tableHeader },
  rowAlt: { backgroundColor: Colors.tableRowAlt },
  tableCell: { flex: 1 },
  cellWide: { flex: 2 },
  headerText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  cellText: { fontSize: 12, color: Colors.textSecondary },
  cellPrimary: { fontSize: 12, fontWeight: '500' as const, color: Colors.textPrimary },
  actRow: { flexDirection: 'row', gap: 6 },
  actBtn: { padding: 4 },
});
