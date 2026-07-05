/**
 * KPICard — Metric card with icon, value, trend
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trash2, Wifi, BarChart2, Target, Scale, TrendingUp, TrendingDown } from 'lucide-react-native';
import { KPICardData } from '@/types/dashboard.types';
import { Colors } from '@/theme/colors';

const ICON_MAP = {
  trash:    Trash2,
  accuracy: Target,
  wifi:     Wifi,
  bar:      BarChart2,
  weight:   Scale,
};

interface Props {
  data: KPICardData;
  style?: object;
}

export const KPICard = memo<Props>(({ data, style }) => {
  const Icon = ICON_MAP[data.iconType];
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconWrap, { backgroundColor: data.iconBg }]}>
        <Icon size={20} color={data.iconColor} strokeWidth={2} />
      </View>
      <Text style={styles.label}>{data.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{data.value}</Text>
        {data.unit ? <Text style={styles.unit}> {data.unit}</Text> : null}
      </View>
      <View style={styles.subRow}>
        {data.trend === 'up'   && <TrendingUp   size={12} color={Colors.kpiGreen} />}
        {data.trend === 'down' && <TrendingDown size={12} color={Colors.kpiRed}   />}
        <Text style={[
          styles.sub,
          data.trend === 'up'   && { color: Colors.kpiGreen },
          data.trend === 'down' && { color: Colors.kpiRed   },
        ]}>
          {data.subLabel}
        </Text>
      </View>
    </View>
  );
});

KPICard.displayName = 'KPICard';

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.dashboardCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dashboardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 4, fontWeight: '500' as const },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 },
  value: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  unit: { fontSize: 14, fontWeight: '600' as const, color: Colors.textMuted, marginBottom: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: 12, color: Colors.textMuted, flex: 1 },
});
