/**
 * GreenGuard — Color Tokens
 * Source of truth: Figma design
 * Never hardcode these values in components.
 */

export const Colors = {
  // ─── Primary Brand Greens ────────────────────────────────────────────────
  primary: '#156B2F',          // Main green: buttons, active icons, CTA (Figma exact)
  primaryDark: '#0E4B21',      // Dark green: wave header, scan banner bg
  primaryMedium: '#1E8A3C',    // Medium green: gradient stops
  primaryLight: '#89C541',     // Secondary green: accent (Figma exact)
  accent: '#89C541',           // Yellow-green: lighter highlights (Figma secondary)
  accentSoft: '#D4EDAA',       // Very light green: subtle tint

  // ─── Backgrounds ─────────────────────────────────────────────────────────
  backgroundWhite: '#FFFFFF',
  backgroundScreen: '#F7FAF4', // Figma exact background
  backgroundCard: '#F0F9E8',   // Light green card background
  backgroundCardAlt: '#F7FAF4',// Alternative card bg
  backgroundSplash: '#0A1F0A', // Splash screen dark green overlay
  backgroundInput: '#FFFFFF',  // Input field background

  // ─── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#1A1A1A',      // Main body text
  textSecondary: '#4A4A4A',    // Secondary text
  textMuted: '#9E9E9E',        // Placeholder, muted labels
  textWhite: '#FFFFFF',        // Text on dark backgrounds
  textGreen: '#156B2F',        // Green text (headings on auth screens)
  textLink: '#1565C0',         // Hyperlink color (User Agreement / Privacy)
  textLinkGreen: '#156B2F',    // Green links (Create Account, Back to Sign In)

  // ─── Borders & Dividers ───────────────────────────────────────────────────
  border: '#C8E6C9',           // Card/input border (light green tint)
  borderMuted: '#E8E8E8',      // Gray border (muted elements)
  divider: '#F0F0F0',          // List dividers

  // ─── Status ───────────────────────────────────────────────────────────────
  success: '#156B2F',
  successLight: '#F0F9E8',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',

  // ─── Reward / Badge States ───────────────────────────────────────────────
  claimedBg: '#F5F5F5',        // Gray background for claimed rewards
  claimedText: '#9E9E9E',      // Gray text for claimed state
  rewardCardBg: '#F0F9E8',     // Claimable reward card bg

  // ─── Chart Colors (Donut Chart - Rewards Screen) ─────────────────────────
  chartPlastic: '#156B2F',     // 40% Plastic — darkest green
  chartPaper: '#2E8B57',       // 13.5% Paper
  chartMetal: '#52B788',       // 11% Metal
  chartOthers: '#95D5B2',      // 15% Others
  chartGlass: '#C8F0D8',       // 9.5% Glass — lightest

  // ─── Map Pins ─────────────────────────────────────────────────────────────
  mapPinRed: '#DC2626',        // CocaCola, Pepsi pins
  mapPinGreen: '#156B2F',      // HCMUT pins

  // ─── Ranking ──────────────────────────────────────────────────────────────
  rankingSilver: '#94A3B8',
  rankingGold: '#F59E0B',
  rankingBronze: '#D97706',

  // ─── Transparent ─────────────────────────────────────────────────────────
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',

  // ─── Social Auth ─────────────────────────────────────────────────────────
  googleRed: '#EA4335',
  facebookBlue: '#1877F2',
} as const;

export type ColorKey = keyof typeof Colors;
