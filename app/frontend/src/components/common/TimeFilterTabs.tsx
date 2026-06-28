/**
 * GreenGuard — TimeFilterTabs Component
 * Segmented tab selector: "1 day" | "1 month" | "all time"
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/theme';

interface Tab {
  value: string;
  label: string;
}

interface TimeFilterTabsProps {
  tabs: Tab[];
  activeValue: string;
  onTabPress: (value: string) => void;
  style?: ViewStyle;
}

export const TimeFilterTabs = memo<TimeFilterTabsProps>(({
  tabs,
  activeValue,
  onTabPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabPress(tab.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

TimeFilterTabs.displayName = 'TimeFilterTabs';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.pill,
    padding: 3,
    alignSelf: 'center',
  },
  tab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.textWhite,
    fontWeight: FontWeight.semiBold,
  },
});
