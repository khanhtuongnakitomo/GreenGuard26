/**
 * GreenGuard — Bottom Tabs Layout
 *
 * Uses a custom BottomTabBar component rendered via the tabBar prop.
 */
import { Tabs } from 'expo-router';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { SidebarTabBar } from '@/components/navigation/SidebarTabBar';
import { useResponsive } from '@/hooks/useResponsive';

export default function TabsLayout() {
  const { isLargeScreen } = useResponsive();

  return (
    <Tabs
      // eslint-disable-next-line react/no-unstable-nested-components
      tabBar={(props) => 
        isLargeScreen ? <SidebarTabBar {...(props as any)} /> : <BottomTabBar {...(props as any)} />
      }
      screenOptions={{
        headerShown: false,
        sceneStyle: isLargeScreen ? { paddingLeft: 320 } : undefined,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
