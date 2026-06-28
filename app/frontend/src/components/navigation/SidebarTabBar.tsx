import React, { memo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, FontWeight, Shadows } from '@/theme';

type TabName = 'home' | 'map' | 'rewards' | 'profile';

interface TabItem {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { name: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'map', label: 'Map', icon: 'map-outline', iconActive: 'map' },
  { name: 'rewards', label: 'Rewards', icon: 'gift-outline', iconActive: 'gift' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

interface SidebarTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  navigation: {
    navigate: (name: string) => void;
    emit: (args: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
  };
}

export const SidebarTabBar = memo<SidebarTabBarProps>(({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  const handleTabPress = (routeName: string, routeKey: string, index: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented && state.index !== index) {
      navigation.navigate(routeName);
    }
  };

  const renderTab = (tab: TabItem) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    const isActive = state.index === routeIndex;
    const routeKey = state.routes[routeIndex]?.key ?? tab.name;

    return (
      <TouchableOpacity
        key={tab.name}
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        onPress={() => handleTabPress(tab.name, routeKey, routeIndex)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isActive ? tab.iconActive : tab.icon}
          size={24}
          color={isActive ? Colors.primary : Colors.textSecondary}
        />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top || Spacing.xl }]}>
      <View style={styles.header}>
        <Image 
          source={require('../../../assets/BKI LOGO/Horiziontal.png')} 
          style={styles.sidebarLogo} 
          resizeMode="cover" 
        />
      </View>

      <View style={styles.navGroup}>
        {TABS.map(renderTab)}
      </View>
    </View>
  );
});

SidebarTabBar.displayName = 'SidebarTabBar';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 320,
    backgroundColor: Colors.backgroundWhite,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.sm,
  },
  sidebarLogo: {
    width: 220,
    height: 70,
  },
  navGroup: {
    flex: 1,
    gap: Spacing.sm,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  tabItemActive: {
    backgroundColor: Colors.backgroundCard,
  },
  tabLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
});
