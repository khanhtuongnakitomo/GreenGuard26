/**
 * GreenGuard — Custom Bottom Tab Bar
 *
 * Layout from Figma:
 * [ Home ] [ Map ] [  FAB  ] [ Rewards ] [ Profile ]
 *
 * The FAB (dark green circle) is raised in the center and opens the QR Scanner modal.
 * Active tab: icon + label in primary green.
 * Inactive tab: icon + label in gray.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const FABButton = memo(() => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedTouchable
      style={[styles.fab, animatedStyle]}
      onPress={() => router.push('/qr-scan')}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.85}
    >
      <Ionicons name="scan-outline" size={28} color={Colors.textWhite} />
    </AnimatedTouchable>
  );
});

FABButton.displayName = 'FABButton';

interface BottomTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  navigation: {
    navigate: (name: string) => void;
    emit: (args: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
  };
  descriptors?: Record<string, unknown>;
  insets?: { bottom: number };
}

export const BottomTabBar = memo<BottomTabBarProps>(({ state, navigation }) => {
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

  const leftTabs = TABS.slice(0, 2);
  const rightTabs = TABS.slice(2, 4);

  const renderTab = (tab: TabItem) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    const isActive = state.index === routeIndex;
    const routeKey = state.routes[routeIndex]?.key ?? tab.name;

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(tab.name, routeKey, routeIndex)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isActive ? tab.iconActive : tab.icon}
          size={22}
          color={isActive ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || Spacing.sm }]}>
      <View style={styles.tabGroup}>
        {leftTabs.map((tab) => renderTab(tab))}
      </View>

      <View style={styles.fabContainer}>
        <FABButton />
      </View>

      <View style={styles.tabGroup}>
        {rightTabs.map((tab) => renderTab(tab))}
      </View>
    </View>
  );
});

BottomTabBar.displayName = 'BottomTabBar';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
    ...Shadows.modal,
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  fabContainer: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  fab: {
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.fab,
  },
});
