/**
 * GreenGuard — Color Tokens
 * Source of truth: Figma design
 * Never hardcode these values in components.
 */

export const Colors = {
  // ─── Primary Brand Greens ────────────────────────────────────────────────
  primary: '#2D6A2D',          // Main green: buttons, active icons, CTA
  primaryDark: '#1A4D1A',      // Dark green: wave header, scan banner bg
  primaryMedium: '#3D8B3D',    // Medium green: gradient stops
  primaryLight: '#4CAF50',     // Light green: accent, progress fill
  accent: '#8BC34A',           // Yellow-green: lighter highlights
  accentSoft: '#C8E6C9',       // Very light green: subtle tint

  // ─── Backgrounds ─────────────────────────────────────────────────────────
  backgroundWhite: '#FFFFFF',
  backgroundScreen: '#F5F5F5', // Light gray screen bg
  backgroundCard: '#E8F5E9',   // Light green card background
  backgroundCardAlt: '#F1F8E9',// Alternative card bg
  backgroundSplash: '#0D2B0D', // Splash screen dark green overlay
  backgroundInput: '#FFFFFF',  // Input field background

  // ─── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#1A1A1A',      // Main body text
  textSecondary: '#4A4A4A',    // Secondary text
  textMuted: '#888888',        // Placeholder, muted labels
  textWhite: '#FFFFFF',        // Text on dark backgrounds
  textGreen: '#2D6A2D',        // Green text (headings on auth screens)
  textLink: '#1565C0',         // Hyperlink color (User Agreement / Privacy)
  textLinkGreen: '#2D6A2D',    // Green links (Create Account, Back to Sign In)

  // ─── Borders & Dividers ───────────────────────────────────────────────────
  border: '#D4E8D4',           // Card/input border (light green tint)
  borderMuted: '#E0E0E0',      // Gray border (muted elements)
  divider: '#EEEEEE',          // List dividers

  // ─── Status ───────────────────────────────────────────────────────────────
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  error: '#F44336',
  errorLight: '#FFEBEE',
  info: '#2196F3',

  // ─── Reward / Badge States ───────────────────────────────────────────────
  claimedBg: '#F5F5F5',        // Gray background for claimed rewards
  claimedText: '#9E9E9E',      // Gray text for claimed state
  rewardCardBg: '#F0FBF0',     // Claimable reward card bg

  // ─── Chart Colors (Donut Chart - Rewards Screen) ─────────────────────────
  chartPlastic: '#1B5E20',     // 40% Plastic — darkest green
  chartPaper: '#388E3C',       // 13.5% Paper
  chartMetal: '#66BB6A',       // 11% Metal
  chartOthers: '#A5D6A7',      // 15% Others
  chartGlass: '#C8E6C9',       // 9.5% Glass — lightest

  // ─── Map Pins ─────────────────────────────────────────────────────────────
  mapPinRed: '#E53935',        // CocaCola, Pepsi pins
  mapPinGreen: '#2D6A2D',      // HCMUT pins

  // ─── Ranking ──────────────────────────────────────────────────────────────
  rankingSilver: '#9E9E9E',
  rankingGold: '#FFC107',
  rankingBronze: '#A1887F',

  // ─── Transparent ─────────────────────────────────────────────────────────
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',

  // ─── Social Auth ─────────────────────────────────────────────────────────
  googleRed: '#EA4335',
  facebookBlue: '#1877F2',
} as const;

export type ColorKey = keyof typeof Colors;
