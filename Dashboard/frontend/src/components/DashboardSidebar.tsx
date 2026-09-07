/**
 * DashboardSidebar — Dark green sidebar matching Figma exactly.
 * Compact presentation sidebar, bg: #1C2B1C
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard, BarChart2, Trash2, FileText, Bell,
  Headphones, Settings, HelpCircle, LogOut,
} from 'lucide-react-native';
import { Colors } from '@/theme/colors';
import { DashboardRoute } from '@/types/dashboard.types';

interface NavItem {
  route: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const MAIN_NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { route: 'analytics', label: 'Analytics',  Icon: BarChart2       },
  { route: 'smartbins', label: 'Smart Bins', Icon: Trash2          },
  { route: 'reports',   label: 'Reports',    Icon: FileText        },
  { route: 'alerts',    label: 'Alerts',     Icon: Bell            },
];

const BOTTOM_NAV: NavItem[] = [
  { route: 'support',  label: 'Support',     Icon: Headphones  },
  { route: 'settings', label: 'Settings',    Icon: Settings    },
  { route: 'help',     label: 'Help Center', Icon: HelpCircle  },
];

interface Props {
  activeRoute: DashboardRoute;
  onNavigate: (route: DashboardRoute) => void;
}

export const SIDEBAR_WIDTH = 176;

export const DashboardSidebar = memo<Props>(({ activeRoute, onNavigate }) => {
  const insets = useSafeAreaInsets();

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = item.route === activeRoute;
    const isDashRoute = ['dashboard','analytics','smartbins','reports','alerts'].includes(item.route);
    return (
      <TouchableOpacity
        style={[styles.navItem, isActive && styles.navItemActive]}
        onPress={() => isDashRoute && onNavigate(item.route as DashboardRoute)}
        activeOpacity={0.75}
      >
        <item.Icon
          size={17}
          strokeWidth={isActive ? 2.2 : 1.8}
          color={isActive ? Colors.sidebarActiveText : Colors.sidebarText}
        />
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.sidebar, { paddingTop: Math.max(insets.top, 14) }]}>
      {/* Logo */}
      <View style={styles.logoWrap}>
        <Image
          source={require('../../assets/logo/White On Dark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* MAIN section */}
        <Text style={styles.sectionLabel}>MAIN</Text>
        {MAIN_NAV.map(item => <NavButton key={item.route} item={item} />)}

        {/* Divider */}
        <View style={styles.divider} />

        {/* TOOLS section */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        {BOTTOM_NAV.map(item => <NavButton key={item.route} item={item} />)}
      </ScrollView>

      {/* Admin profile */}
      <View style={[styles.profile, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.profileDivider} />
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>Mark</Text>
            <Text style={styles.profileRole}>Admin</Text>
          </View>
          <LogOut size={14} color={Colors.sidebarText} />
        </View>
      </View>
    </View>
  );
});

DashboardSidebar.displayName = 'DashboardSidebar';

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.sidebarBg,
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    zIndex: 100,
    borderRightWidth: 1,
    borderRightColor: Colors.sidebarBorder,
  },
  logoWrap: {
    paddingHorizontal: 8,
    paddingBottom: 14,
    paddingTop: 16,
    alignItems: 'center',
  },
  logo: { width: 156, height: 50, transform: [{ scale: 1.08 }] },
  scroll: { flex: 1, paddingHorizontal: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.sidebarText,
    letterSpacing: 1.4,
    marginBottom: 5,
    marginTop: 8,
    paddingHorizontal: 7,
    opacity: 0.6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginBottom: 4,
    gap: 9,
  },
  navItemActive: { backgroundColor: Colors.sidebarActiveBg },
  navLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.sidebarText,
    flexShrink: 1,
  },
  navLabelActive: {
    color: Colors.sidebarActiveText,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.sidebarDivider,
    marginVertical: 8,
    marginHorizontal: 8,
  },
  profile: { paddingHorizontal: 8 },
  profileDivider: {
    height: 1,
    backgroundColor: Colors.sidebarDivider,
    marginBottom: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.sidebarActiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.sidebarActiveText,
  },
  avatarText: { fontSize: 14, fontWeight: '700' as const, color: Colors.sidebarActiveText },
  profileMeta: { flex: 1 },
  profileName: { fontSize: 13, fontWeight: '600' as const, color: '#FFFFFF' },
  profileRole: { fontSize: 12, color: Colors.sidebarText, marginTop: 1 },
});
