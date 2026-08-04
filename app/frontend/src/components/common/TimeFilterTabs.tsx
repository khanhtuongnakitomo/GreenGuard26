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
import { Spacing, Radius, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

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
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundCard }, style]}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.tab,
              isActive && { backgroundColor: colors.primary },
            ]}
            onPress={() => onTabPress(tab.value)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.textWhite : colors.textMuted },
                isActive && styles.labelActive,
              ]}
            >
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
    borderRadius: Radius.pill,
    padding: 3,
    alignSelf: 'center',
  },
  tab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  labelActive: {
    fontWeight: FontWeight.semiBold,
  },
});
