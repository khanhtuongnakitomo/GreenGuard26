/**
 * DashboardTopNav — Fixed top bar: title, icon buttons, Export Report CTA
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Search, Bell, Settings, Download } from 'lucide-react-native';
import { Colors } from '@/theme/colors';

interface Props {
  title: string;
  subtitle?: string;
  onExportPress?: () => void;
}

export const DashboardTopNav = memo<Props>(({ title, subtitle, onExportPress }) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;

  return (
    <View style={[styles.bar, isCompact && styles.barCompact]}>
      <View style={styles.left}>
        <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, isCompact && styles.subCompact]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {!isCompact ? (
        <View style={styles.right}>
          {[Search, Bell, Settings].map((Icon, i) => (
            <TouchableOpacity key={i} style={styles.iconBtn} activeOpacity={0.7}>
              <Icon size={17} color={Colors.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.exportBtn} onPress={onExportPress} activeOpacity={0.85}>
            <Download size={14} color="#fff" />
            <Text style={styles.exportText}>Export Report</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

DashboardTopNav.displayName = 'DashboardTopNav';

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: Colors.dashboardCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dashboardBorder,
  },
  barCompact: { paddingHorizontal: 16, paddingVertical: 12 },
  left: { flex: 1 },
  title: { fontSize: 21, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.3 },
  titleCompact: { fontSize: 18 },
  sub: { fontSize: 13, color: Colors.textMuted, marginTop: 3, flexShrink: 1 },
  subCompact: { fontSize: 10, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.dashboardBorder,
    backgroundColor: Colors.dashboardCard,
    alignItems: 'center', justifyContent: 'center',
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 7,
  },
  exportText: { fontSize: 13, fontWeight: '600' as const, color: '#fff' },
});
