/**
 * GreenGuard — Zustand Theme Store
 *
 * Manages:
 *  - colorScheme: user's preference ('light' | 'dark' | 'system')
 *  - resolvedTheme: actual resolved theme based on scheme + device
 *  - Persistence via AsyncStorage
 *  - Listens to device Appearance changes (for 'system' mode)
 */
import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = '@greenguard/colorScheme';

function resolveTheme(
  scheme: ColorSchemePreference,
  deviceScheme: ColorSchemeName,
): ResolvedTheme {
  if (scheme === 'system') {
    return deviceScheme === 'dark' ? 'dark' : 'light';
  }
  return scheme;
}

interface ThemeState {
  colorScheme: ColorSchemePreference;
  resolvedTheme: ResolvedTheme;
  setColorScheme: (scheme: ColorSchemePreference) => Promise<void>;
  initialize: () => Promise<void>;
  _handleDeviceChange: (colorScheme: ColorSchemeName) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorScheme: 'system',
  resolvedTheme: resolveTheme('system', Appearance.getColorScheme() || 'light'),

  setColorScheme: async (scheme: ColorSchemePreference) => {
    const deviceScheme = Appearance.getColorScheme() || 'light';
    const resolved = resolveTheme(scheme, deviceScheme);
    set({ colorScheme: scheme, resolvedTheme: resolved });
    await AsyncStorage.setItem(STORAGE_KEY, scheme);
  },

  initialize: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const scheme: ColorSchemePreference =
        saved === 'light' || saved === 'dark' || saved === 'system'
          ? saved
          : 'system';
      const deviceScheme = Appearance.getColorScheme() || 'light';
      const resolved = resolveTheme(scheme, deviceScheme);
      set({ colorScheme: scheme, resolvedTheme: resolved });
    } catch {
      // Fallback to system
      const resolved = resolveTheme('system', Appearance.getColorScheme() || 'light');
      set({ colorScheme: 'system', resolvedTheme: resolved });
    }
  },

  _handleDeviceChange: (deviceScheme: ColorSchemeName) => {
    const { colorScheme } = get();
    if (colorScheme === 'system') {
      set({ resolvedTheme: resolveTheme('system', deviceScheme) });
    }
  },
}));
