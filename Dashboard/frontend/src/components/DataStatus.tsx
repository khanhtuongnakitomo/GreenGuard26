import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

export function DataStatus({ demo, error, updatedAt = 0 }: { demo: boolean; error: boolean; updatedAt?: number }) {
  if (!demo && !error && updatedAt) return null;
  const text = demo ? 'PRESENTATION MODE · Dữ liệu minh họa'
    : error && updatedAt ? `Mất kết nối · Đang hiển thị dữ liệu lúc ${new Date(updatedAt).toLocaleTimeString('vi-VN')}`
    : error ? 'Không tải được dữ liệu trực tiếp · Đang chờ kết nối lại'
    : 'Đang tải dữ liệu trực tiếp…';
  return <View style={styles.banner}><Text accessibilityRole="alert" style={styles.text}>{text}</Text></View>;
}
const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.warningBg, padding: 12, flexShrink: 0 },
  text: { color: Colors.textSecondary, fontSize: 12, flexShrink: 1 },
});
