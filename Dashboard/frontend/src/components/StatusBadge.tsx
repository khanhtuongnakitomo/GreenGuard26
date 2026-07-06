/**
 * StatusBadge — Pill badge for bin status values
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BinStatus } from '@/types/dashboard.types';
import { Colors } from '@/theme/colors';

const STATUS_CONFIG: Record<BinStatus, { bg: string; text: string; dot: string }> = {
  'Online':      { bg: Colors.successBg,  text: Colors.success,  dot: Colors.success  },
  'Offline':     { bg: '#F3F4F6',         text: Colors.textMuted, dot: Colors.textMuted },
  'Error':       { bg: Colors.errorBg,    text: Colors.error,    dot: Colors.error    },
  'Nearly Full': { bg: Colors.warningBg,  text: Colors.warning,  dot: Colors.warning  },
};

interface Props { status: BinStatus; }

export const StatusBadge = memo<Props>(({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.text, { color: cfg.text }]}>{status}</Text>
    </View>
  );
});

StatusBadge.displayName = 'StatusBadge';

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '600' as const },
});
