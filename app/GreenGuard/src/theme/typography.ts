/**
 * GreenGuard — Typography Tokens
 * Based on Figma design. Font: Inter
 */
import { Platform } from 'react-native';

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Fallback for when Inter is loading
  systemRegular: Platform.select({ ios: 'System', android: 'sans-serif' }) ?? 'sans-serif',
  systemBold: Platform.select({ ios: 'System', android: 'sans-serif-bold' }) ?? 'sans-serif',
} as const;

export const FontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 22,
  '4xl': 24,
  '5xl': 28,
  '6xl': 32,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
} as const;

/** Pre-built text style presets matching the Figma design */
export const TextStyles = {
  // Splash
  displayWelcome: {
    fontSize: FontSize['5xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['5xl'] * LineHeight.normal,
  },
  // Auth screen titles
  authTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['3xl'] * LineHeight.normal,
  },
  // Screen headings
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xl * LineHeight.normal,
  },
  // Section headers
  sectionHeader: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.lg * LineHeight.normal,
  },
  // Card titles
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.md * LineHeight.normal,
  },
  // Body text
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.relaxed,
  },
  bodyMedium: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.relaxed,
  },
  // Captions
  caption: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.xs * LineHeight.relaxed,
  },
  // Large points display
  pointsDisplay: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['4xl'] * LineHeight.tight,
  },
  // Button text
  buttonLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.lg * LineHeight.normal,
  },
  // Tab bar labels
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.xs * LineHeight.normal,
  },
  // Input label
  inputLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  // "View all" links
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
} as const;
