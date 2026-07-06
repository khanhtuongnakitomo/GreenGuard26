/**
 * GreenGuard Dashboard — Color Tokens
 * Extracted from Figma admin panel design.
 */
export const Colors = {
  // ─── Sidebar ─────────────────────────────────────────────────────────────
  sidebarBg: '#1C2B1C',
  sidebarActiveBg: '#2D5016',
  sidebarActiveText: '#4ADE80',
  sidebarText: '#8BAF8B',
  sidebarBorder: '#2A3D2A',
  sidebarDivider: '#2A3D2A',

  // ─── Dashboard Backgrounds ────────────────────────────────────────────────
  dashboardBg: '#F0F2F0',
  dashboardCard: '#FFFFFF',
  dashboardBorder: '#E5E7EB',

  // ─── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#9CA3AF',
  textWhite: '#FFFFFF',

  // ─── Primary Green ────────────────────────────────────────────────────────
  primary: '#156B2F',
  primaryLight: '#22C55E',

  // ─── KPI Colors ───────────────────────────────────────────────────────────
  kpiGreen: '#22C55E',
  kpiGreenBg: '#DCFCE7',
  kpiOrange: '#F97316',
  kpiOrangeBg: '#FFF7ED',
  kpiBlue: '#3B82F6',
  kpiBlueBg: '#EFF6FF',
  kpiRed: '#EF4444',
  kpiRedBg: '#FEF2F2',
  kpiPurple: '#8B5CF6',
  kpiPurpleBg: '#EDE9FE',

  // ─── Chart Colors ─────────────────────────────────────────────────────────
  chartBar: '#4ADE80',
  chartBarDark: '#16A34A',
  chartLine: '#22C55E',
  chartLineArea: 'rgba(34,197,94,0.12)',

  // ─── Waste Type Pie ────────────────────────────────────────────────────────
  dashPlastic: '#4ADE80',
  dashMetal: '#22C55E',
  dashPaper: '#15803D',
  dashOthers: '#BBF7D0',

  // ─── Bin Status ───────────────────────────────────────────────────────────
  binOnline: '#22C55E',
  binOffline: '#9CA3AF',
  binError: '#EF4444',
  binNearlyFull: '#F97316',

  // ─── Table ────────────────────────────────────────────────────────────────
  tableHeader: '#F9FAFB',
  tableBorder: '#F3F4F6',
  tableRowAlt: '#FAFAFA',

  // ─── Status ───────────────────────────────────────────────────────────────
  success: '#22C55E',
  warning: '#F97316',
  error: '#EF4444',
  info: '#3B82F6',
  successBg: '#DCFCE7',
  warningBg: '#FFF7ED',
  errorBg: '#FEF2F2',
  infoBg: '#EFF6FF',

  // ─── Borders ──────────────────────────────────────────────────────────────
  border: '#E5E7EB',
  divider: '#F3F4F6',

  // ─── Misc ──────────────────────────────────────────────────────────────────
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export type ColorKey = keyof typeof Colors;
