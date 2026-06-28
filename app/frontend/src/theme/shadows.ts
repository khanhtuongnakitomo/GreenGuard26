/**
 * GreenGuard — Shadow Tokens
 * Platform-aware shadows matching Figma card elevation
 */
import { Platform } from 'react-native';

const createShadow = (
  elevation: number,
  shadowColor: string,
  opacity: number,
  radius: number,
  offset: { width: number; height: number },
) => ({
  ...Platform.select({
    ios: {
      shadowColor,
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
  }),
});

export const Shadows = {
  none: {},
  xs: createShadow(1, '#000', 0.06, 2, { width: 0, height: 1 }),
  sm: createShadow(2, '#000', 0.08, 4, { width: 0, height: 2 }),
  md: createShadow(4, '#000', 0.10, 8, { width: 0, height: 4 }),
  lg: createShadow(8, '#000', 0.12, 12, { width: 0, height: 6 }),
  xl: createShadow(12, '#000', 0.15, 16, { width: 0, height: 8 }),

  // Semantic aliases
  card: createShadow(3, '#000', 0.08, 6, { width: 0, height: 2 }),
  button: createShadow(4, '#2D6A2D', 0.25, 8, { width: 0, height: 4 }),
  fab: createShadow(8, '#000', 0.20, 10, { width: 0, height: 4 }),
  modal: createShadow(16, '#000', 0.20, 20, { width: 0, height: -4 }),
} as const;

export type ShadowKey = keyof typeof Shadows;
