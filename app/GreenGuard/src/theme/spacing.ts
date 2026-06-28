/**
 * GreenGuard — Spacing Tokens
 * 4-point grid system
 */

export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,

  // Semantic aliases
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,

  // Screen horizontal padding
  screenHorizontal: 16,
  // Card internal padding
  cardPadding: 16,
  // Section vertical gap
  sectionGap: 24,
  // Input height
  inputHeight: 52,
  // Button height
  buttonHeight: 52,
  // Bottom tab height
  tabBarHeight: 70,
  // FAB size
  fabSize: 56,
} as const;

export type SpacingKey = keyof typeof Spacing;
