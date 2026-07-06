/**
 * GreenGuard — Root Layout
 *
 * Responsibilities:
 * 1. Load fonts (Inter family)
 * 2. Hide splash screen when ready
 * 3. Initialize auth state from AsyncStorage
 * 4. Wrap app in QueryClientProvider
 * 5. Auth gate: redirect to auth or main tabs
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
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { NotificationProvider } from '@/components/common/NotificationProvider';

// Keep splash visible until fonts are loaded
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { initialize, isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initialize().then(() => setIsReady(true));
  }, [initialize]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!isReady || (!fontsLoaded && !fontError)) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSplash = segments[0] === 'splash' || !segments[0]; // !segments[0] is index
    
    // Protect all routes except auth and splash
    if (!isAuthenticated && !inAuthGroup && !isSplash) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && (inAuthGroup || isSplash)) {
      // Wait, we don't want to interrupt splash screen animation immediately if it's splash.
      // But if they are on auth and already authenticated, redirect to home.
      if (inAuthGroup) {
        router.replace('/(tabs)/home');
      }
    }
  }, [isAuthenticated, isReady, segments, fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
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
        </Stack>
        {/* Global notification overlay */}
        <NotificationProvider />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
