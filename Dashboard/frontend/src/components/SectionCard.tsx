/**
 * SectionCard — White card wrapper with optional header
 */
import React, { memo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

interface Props {
  title?: string;
  rightLabel?: string;
  rightElement?: ReactNode;
  onRightPress?: () => void;
  children: ReactNode;
  style?: object;
  contentStyle?: object;
  noPadding?: boolean;
}

export const SectionCard = memo<Props>(({
  title, rightLabel, rightElement, onRightPress,
  children, style, contentStyle, noPadding,
}) => (
  <View style={[styles.card, style]}>
    {(title || rightLabel || rightElement) ? (
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {rightElement ?? (rightLabel ? (
          <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : null)}
      </View>
    ) : null}
    <View style={[noPadding ? undefined : styles.body, contentStyle]}>
      {children}
    </View>
  </View>
));

SectionCard.displayName = 'SectionCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dashboardCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dashboardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dashboardBorder,
  },
  title: { fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
  rightLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.primary },
  body: { padding: 16 },
});
