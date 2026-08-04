/**
 * GreenGuard — Root Layout
 *
 * Responsibilities:
 * 1. Load fonts (Inter family)
 * 2. Initialize i18n (language detection + persistence)
 * 3. Hide splash screen when ready
 * 4. Initialize auth state from AsyncStorage
 * 5. Wrap app in QueryClientProvider + ThemeProvider
 * 6. Auth gate: redirect to auth or main tabs
 * 7. Dynamic StatusBar based on resolved theme
 */
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { NotificationProvider } from '@/components/common/NotificationProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useThemeStore } from '@/store/themeStore';
import { initI18n } from '@/i18n';

// Keep splash visible until fonts + i18n are ready
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppContent() {
  const { initialize, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  useEffect(() => {
    initialize().then(() => setIsReady(true));
  }, [initialize]);

  useEffect(() => {
    if (!isReady || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isIndex = !segments[0]; // index.tsx redirects immediately, ignore

    // Protect all routes except auth
    if (!isAuthenticated && !inAuthGroup && !isIndex) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isLoading, isReady, segments, router]);

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="qr-scan"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="rewards/tasks" />
        <Stack.Screen name="rewards/brand-task" />
        <Stack.Screen name="rewards/voucher-claim" />
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="impact" />
        <Stack.Screen name="history" />
        <Stack.Screen
          name="wallet"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      {/* Global notification overlay */}
      <NotificationProvider />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  const appReady = (fontsLoaded || !!fontError) && i18nReady;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
