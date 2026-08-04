/**
 * GreenGuard — useTheme Hook
 *
 * Returns the current theme colors + helpers.
 *
 * Usage:
 *   const { colors, resolvedTheme, colorScheme, setColorScheme, isDark } = useTheme();
 */
import { useThemeStore } from '@/store/themeStore';
import { LightColors, DarkColors, ThemeColors } from '@/theme/colors';
import type { ColorSchemePreference, ResolvedTheme } from '@/store/themeStore';

export interface UseThemeReturn {
  colors: ThemeColors;
  resolvedTheme: ResolvedTheme;
  colorScheme: ColorSchemePreference;
  setColorScheme: (scheme: ColorSchemePreference) => Promise<void>;
  isDark: boolean;
}

export function useTheme(): UseThemeReturn {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);

  const colors: ThemeColors = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return {
    colors,
    resolvedTheme,
    colorScheme,
    setColorScheme,
    isDark: resolvedTheme === 'dark',
  };
}
