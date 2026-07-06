/**
 * GreenGuard Dashboard — TypeScript Types
 */

// ─── KPI Cards ────────────────────────────────────────────────────────────────
export interface KPICardData {
  id: string;
  label: string;
  value: string;
  unit?: string;
  subLabel: string;
  trend?: 'up' | 'down';
  iconType: 'trash' | 'accuracy' | 'wifi' | 'bar' | 'weight';
  iconColor: string;
  iconBg: string;
}

// ─── Chart Data ────────────────────────────────────────────────────────────────
export interface TrendPoint {
  label: string;
  value: number;
}

// ─── Waste Types ───────────────────────────────────────────────────────────────
export interface WasteSlice {
  label: string;
  percentage: number;
  weightKg: number;
  color: string;
}

// ─── Compartments ─────────────────────────────────────────────────────────────
export interface CompartmentData {
  label: string;
  value: number;
  color: string;
}

// ─── Recent Classifications ────────────────────────────────────────────────────
export interface RecentClassification {
  id: string;
  wasteType: string;
  wasteColor: string;
  binId: string;
  time: string;
  user: string;
  confidence: string;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ─── Smart Bins ────────────────────────────────────────────────────────────────
export type BinStatus = 'Online' | 'Offline' | 'Error' | 'Nearly Full';

export interface SmartBinRow {
  binId: string;
  location: string;
  status: BinStatus;
  fillLevel: number;
  lastUpdate: string;
}

export interface SmartBin {
  binId: string;
  location: string;
  coordinates: { lat: number; lng: number };
  status: BinStatus;
  fillLevel: number;
  hardware: {
    camera: boolean;
    jetsonNano: boolean;
    esp32s3: boolean;
    servoMotors: boolean;
    aiModel: boolean;
  };
  lastUpdate: string;
}

export interface BinOverviewItem {
  count: number;
  label: BinStatus;
  color: string;
  total: number;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────
export interface CampaignStat {
  participants: number;
  collected: number;
  recycled: string;
  trend: TrendPoint[];
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export type AlertSeverity = 'warning' | 'error' | 'info';

export interface AlertCardData {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export type ReportType = 'PDF' | 'Excel';

export interface ReportHistoryItem {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  createdAt: string;
  size: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface TopLocation {
  name: string;
  amount: string;
  unit: string;
}

export interface DailyAverage {
  label: string;
  percentage: number;
  color: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
export type DashboardRoute = 'dashboard' | 'analytics' | 'smartbins' | 'reports' | 'alerts';
