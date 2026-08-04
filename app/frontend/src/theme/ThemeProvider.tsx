/**
 * GreenGuard — ThemeProvider
 *
 * Wraps the app to:
 * 1. Initialize theme store from AsyncStorage on mount
 * 2. Listen to device Appearance changes for 'system' mode
 * 3. Apply StatusBar style based on resolved theme
 */
import React, { useEffect, useRef } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const initialize = useThemeStore((s) => s.initialize);
  const handleDeviceChange = useThemeStore((s) => s._handleDeviceChange);
  const initCalledRef = useRef(false);

  useEffect(() => {
    if (!initCalledRef.current) {
      initCalledRef.current = true;
      initialize();
    }
  }, [initialize]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(
      ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
        handleDeviceChange(colorScheme);
      },
    );
    return () => subscription.remove();
  }, [handleDeviceChange]);

  return <>{children}</>;
}
