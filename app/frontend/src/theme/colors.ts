/**
 * GreenGuard — Color Tokens
 *
 * Contains:
 *  - Palette: raw color constants (brand, semantic)
 *  - ThemeColors: interface for all theme-able colors
 *  - LightColors: light theme implementation
 *  - DarkColors: dark theme implementation
 *  - Colors: backward-compat alias for LightColors
 */

// ─── Raw Brand Palette ────────────────────────────────────────────────────────
export const Palette = {
  // Brand greens
  green900: '#0E4B21',
  green800: '#156B2F',
  green700: '#1E8A3C',
  green500: '#22C55E',
  green400: '#4ADE80',
  green300: '#86EFAC',
  green200: '#BBF7D0',
  green100: '#DCFCE7',
  green50:  '#F0F9E8',

  // Accent
  lime400: '#89C541',
  limeLight: '#D4EDAA',

  // Neutrals
  white: '#FFFFFF',
  gray50:  '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  gray950: '#080F1C',

  // Status
  amber400:  '#F59E0B',
  amber100:  '#FEF3C7',
  amber50:   '#FFFBEB',
  red400:    '#F87171',
  red500:    '#EF4444',
  red100:    '#FEE2E2',
  red900:    '#450A0A',
  blue400:   '#60A5FA',
  blue500:   '#3B82F6',
  blue100:   '#DBEAFE',

  // Social
  googleRed:    '#EA4335',
  facebookBlue: '#1877F2',

  // Transparent
  transparent: 'transparent' as const,
} as const;

// ─── ThemeColors Interface ─────────────────────────────────────────────────────
export interface ThemeColors {
  // Primary brand
  primary: string;
  primaryDark: string;
  primaryMedium: string;
  primaryLight: string;
  accent: string;
  accentSoft: string;

  // Backgrounds
  backgroundWhite: string;
  backgroundScreen: string;
  backgroundCard: string;
  backgroundCardAlt: string;
  backgroundSplash: string;
  backgroundInput: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textWhite: string;
  textGreen: string;
  textLink: string;
  textLinkGreen: string;
  textSecondaryNew: string;

  // Borders & Dividers
  border: string;
  borderMuted: string;
  divider: string;
  cardBorder: string;

  // Status
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;

  // Reward / Badge
  claimedBg: string;
  claimedText: string;
  rewardCardBg: string;

  // Charts
  chartPlastic: string;
  chartPaper: string;
  chartMetal: string;
  chartOthers: string;
  chartGlass: string;

  // Map
  mapPinRed: string;
  mapPinGreen: string;

  // Ranking
  rankingSilver: string;
  rankingGold: string;
  rankingBronze: string;

  // Transparent / Overlay
  transparent: 'transparent';
  overlay: string;
  overlayLight: string;

  // Social
  googleRed: string;
  facebookBlue: string;

  // Layout helpers
  greenLight: string;

  // Warning / Info badges
  warningBg: string;
  warningBorder: string;
  infoBg: string;
  infoBorder: string;
  infoText: string;

  // Tab / section
  tabActiveDot: string;
  sectionLinkColor: string;
}

// ─── Light Theme ──────────────────────────────────────────────────────────────
export const LightColors: ThemeColors = {
  primary: '#156B2F',
  primaryDark: '#0E4B21',
  primaryMedium: '#1E8A3C',
  primaryLight: '#89C541',
  accent: '#89C541',
  accentSoft: '#D4EDAA',

  backgroundWhite: '#FFFFFF',
  backgroundScreen: '#F7FAF4',
  backgroundCard: '#F0F9E8',
  backgroundCardAlt: '#F7FAF4',
  backgroundSplash: '#0A1F0A',
  backgroundInput: '#FFFFFF',

  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted: '#9E9E9E',
  textWhite: '#FFFFFF',
  textGreen: '#156B2F',
  textLink: '#1565C0',
  textLinkGreen: '#156B2F',
  textSecondaryNew: '#647067',

  border: '#C8E6C9',
  borderMuted: '#E8E8E8',
  divider: '#F0F0F0',
  cardBorder: '#D6DDD2',

  success: '#156B2F',
  successLight: '#F0F9E8',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',

  claimedBg: '#F5F5F5',
  claimedText: '#9E9E9E',
  rewardCardBg: '#F0F9E8',

  chartPlastic: '#156B2F',
  chartPaper: '#2E8B57',
  chartMetal: '#52B788',
  chartOthers: '#95D5B2',
  chartGlass: '#C8F0D8',

  mapPinRed: '#DC2626',
  mapPinGreen: '#156B2F',

  rankingSilver: '#94A3B8',
  rankingGold: '#F59E0B',
  rankingBronze: '#D97706',

  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',

  googleRed: '#EA4335',
  facebookBlue: '#1877F2',

  greenLight: '#E7F4EA',

  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoText: '#1D4ED8',

  tabActiveDot: '#156B2F',
  sectionLinkColor: '#156B2F',
};

// ─── Dark Theme ───────────────────────────────────────────────────────────────
export const DarkColors: ThemeColors = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryMedium: '#4ADE80',
  primaryLight: '#86EFAC',
  accent: '#86EFAC',
  accentSoft: '#166534',

  backgroundWhite: '#1E293B',
  backgroundScreen: '#0F172A',
  backgroundCard: '#1E293B',
  backgroundCardAlt: '#162032',
  backgroundSplash: '#020b02',
  backgroundInput: '#1E293B',

  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  textWhite: '#FFFFFF',
  textGreen: '#4ADE80',
  textLink: '#60A5FA',
  textLinkGreen: '#4ADE80',
  textSecondaryNew: '#94A3B8',

  border: '#166534',
  borderMuted: '#334155',
  divider: '#1E293B',
  cardBorder: '#334155',

  success: '#22C55E',
  successLight: '#14532D',
  warning: '#F59E0B',
  warningLight: '#451A03',
  error: '#F87171',
  errorLight: '#450A0A',
  info: '#60A5FA',

  claimedBg: '#1E293B',
  claimedText: '#64748B',
  rewardCardBg: '#14532D',

  chartPlastic: '#22C55E',
  chartPaper: '#4ADE80',
  chartMetal: '#86EFAC',
  chartOthers: '#A7F3D0',
  chartGlass: '#BBF7D0',

  mapPinRed: '#F87171',
  mapPinGreen: '#22C55E',

  rankingSilver: '#94A3B8',
  rankingGold: '#F59E0B',
  rankingBronze: '#D97706',

  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',

  googleRed: '#EA4335',
  facebookBlue: '#1877F2',

  greenLight: '#14532D',

  warningBg: '#451A03',
  warningBorder: '#78350F',
  infoBg: '#1E3A5F',
  infoBorder: '#1D4ED8',
  infoText: '#93C5FD',

  tabActiveDot: '#22C55E',
  sectionLinkColor: '#4ADE80',
};

// ─── Backward-compat alias (always Light) ────────────────────────────────────
export const Colors = LightColors;

export type ColorKey = keyof ThemeColors;
