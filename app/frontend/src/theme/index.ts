/**
 * GreenGuard — Theme barrel export
 * Import everything from here in components.
 *
 * Usage:
 *   import { Colors, Spacing, Radius, Shadows, FontSize, FontWeight } from '@/theme';
 *   import { LightColors, DarkColors, ThemeColors } from '@/theme';
 *   import { useTheme } from '@/hooks/useTheme';
 */

export { Colors, LightColors, DarkColors } from './colors';
export type { ThemeColors, ColorKey } from './colors';

export {
  FontFamily,
  FontSize,
  FontWeight,
  LineHeight,
  TextStyles,
} from './typography';

export { Spacing } from './spacing';
export type { SpacingKey } from './spacing';

export { Radius } from './radius';
export type { RadiusKey } from './radius';

export { Shadows } from './shadows';
export type { ShadowKey } from './shadows';

export { ThemeProvider } from './ThemeProvider';
