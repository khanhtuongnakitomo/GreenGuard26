/**
 * GreenGuard Dashboard — Root App with State-based Navigation
 * No Expo Router needed — simple useState-driven navigation.
 */
import React, { useState, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { DashboardRoute } from '@/types/dashboard.types';
import DashboardScreen  from '@/screens/DashboardScreen';
import AnalyticsScreen  from '@/screens/AnalyticsScreen';
import SmartBinsScreen  from '@/screens/SmartBinsScreen';
import ReportsScreen    from '@/screens/ReportsScreen';

const queryClient = new QueryClient();

export default function App() {
  const [route, setRoute] = useState<DashboardRoute>('dashboard');

  const navigate = useCallback((r: DashboardRoute) => setRoute(r), []);

  const Screen = {
    dashboard: DashboardScreen,
    analytics:  AnalyticsScreen,
    smartbins:  SmartBinsScreen,
    reports:    ReportsScreen,
    alerts:     DashboardScreen, // fallback
  }[route];

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Screen onNavigate={navigate} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
