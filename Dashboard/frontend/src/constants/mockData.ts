/**
 * GreenGuard Dashboard — Mock Data (matches Figma exactly)
 */
import { Colors } from '@/theme/colors';
import {
  KPICardData, TrendPoint, WasteSlice, CompartmentData,
  RecentClassification, SmartBinRow, SmartBin, BinOverviewItem,
  CampaignStat, AlertCardData, ReportHistoryItem, TopLocation, DailyAverage,
} from '@/types/dashboard.types';

// ─── Dashboard KPI ────────────────────────────────────────────────────────────
export const DASHBOARD_KPI: KPICardData[] = [
  {
    id: 'k1', label: 'Total Recycled Items', value: '12,584', unit: '- 205Kg',
    subLabel: '+310 items from last month', trend: 'up',
    iconType: 'trash', iconColor: Colors.kpiGreen, iconBg: Colors.kpiGreenBg,
  },
  {
    id: 'k2', label: 'AI Detection Accuracy', value: '95.3%',
    subLabel: '+1.2% from last month', trend: 'up',
    iconType: 'accuracy', iconColor: Colors.kpiBlue, iconBg: Colors.kpiBlueBg,
  },
  {
    id: 'k3', label: 'Active Smart Bins', value: '42/45',
    subLabel: '2 Online',
    iconType: 'wifi', iconColor: Colors.kpiGreen, iconBg: Colors.kpiGreenBg,
  },
  {
    id: 'k4', label: "Today's Classifications", value: '500',
    subLabel: '+52 discov from yesterday', trend: 'up',
    iconType: 'bar', iconColor: Colors.kpiBlue, iconBg: Colors.kpiBlueBg,
  },
];

// ─── Analytics KPI ────────────────────────────────────────────────────────────
export const ANALYTICS_KPI: KPICardData[] = [
  {
    id: 'ak1', label: 'Total Classifications', value: '12,584',
    subLabel: '+310 discov from last month', trend: 'up',
    iconType: 'trash', iconColor: Colors.kpiGreen, iconBg: Colors.kpiGreenBg,
  },
  {
    id: 'ak2', label: 'Average Accuracy', value: '95.3%',
    subLabel: '+1.2% from last month', trend: 'up',
    iconType: 'accuracy', iconColor: Colors.kpiBlue, iconBg: Colors.kpiBlueBg,
  },
  {
    id: 'ak3', label: 'Total Waste', value: '205 Kg',
    subLabel: '+38 Kg from last month', trend: 'up',
    iconType: 'weight', iconColor: Colors.kpiOrange, iconBg: Colors.kpiOrangeBg,
  },
  {
    id: 'ak4', label: 'Active Smart Bins', value: '42/45',
    subLabel: '2 Online',
    iconType: 'wifi', iconColor: Colors.kpiGreen, iconBg: Colors.kpiGreenBg,
  },
  {
    id: 'ak5', label: "Today's Classifications", value: '500',
    subLabel: '+52 discov from yesterday', trend: 'up',
    iconType: 'bar', iconColor: Colors.kpiBlue, iconBg: Colors.kpiBlueBg,
  },
];

// ─── Classification Trend ─────────────────────────────────────────────────────
export const CLASSIFICATION_TREND: TrendPoint[] = [
  { label: 'Jan', value: 820 },
  { label: 'Feb', value: 640 },
  { label: 'Mar', value: 780 },
  { label: 'Apr', value: 900 },
  { label: 'May', value: 760 },
  { label: 'Jun', value: 1050 },
  { label: 'Jul', value: 920 },
  { label: 'Aug', value: 870 },
];

// ─── Waste Type Slices ────────────────────────────────────────────────────────
export const WASTE_SLICES: WasteSlice[] = [
  { label: 'Plastic', percentage: 44.8, weightKg: 88.8, color: Colors.dashPlastic },
  { label: 'Metal',   percentage: 26.2, weightKg: 52.0, color: Colors.dashMetal   },
  { label: 'Paper',   percentage: 21.6, weightKg: 42.8, color: Colors.dashPaper   },
  { label: 'Others',  percentage: 7.4,  weightKg: 14.7, color: Colors.dashOthers  },
];
export const WASTE_TOTAL_KG = 198.26;

// ─── Compartment Utilization ──────────────────────────────────────────────────
export const COMPARTMENTS: CompartmentData[] = [
  { label: 'MetalBin',  value: 0,  color: Colors.dashMetal  },
  { label: 'PaperBin',  value: 96, color: Colors.dashPaper  },
  { label: 'OthersBin', value: 26, color: Colors.dashOthers },
];

// ─── Recent Classifications ───────────────────────────────────────────────────
export const RECENT_CLASSIFICATIONS: RecentClassification[] = [
  { id: 'rc1', wasteType: 'Plastic', wasteColor: Colors.dashPlastic, binId: 'GG-001', time: 'Jun 10, 2025 10:13 AM', user: 'user_002', confidence: '94.3%', confidenceLevel: 'high'   },
  { id: 'rc2', wasteType: 'Paper',   wasteColor: Colors.dashPaper,   binId: 'GG-001', time: 'Jun 10, 2025 09:41 AM', user: 'user_301', confidence: '93.2%', confidenceLevel: 'high'   },
  { id: 'rc3', wasteType: 'Metal',   wasteColor: Colors.dashMetal,   binId: 'GG-001', time: 'Jun 10, 2025 09:20 AM', user: 'user_301', confidence: '91.8%', confidenceLevel: 'high'   },
  { id: 'rc4', wasteType: 'Plastic', wasteColor: Colors.dashPlastic, binId: 'GG-002', time: 'Jun 10, 2025 09:07 AM', user: 'user_283', confidence: '76.4%', confidenceLevel: 'medium' },
  { id: 'rc5', wasteType: 'Others',  wasteColor: Colors.dashOthers,  binId: 'GG-003', time: 'Jun 10, 2025 08:52 AM', user: 'user_098', confidence: '81.6%', confidenceLevel: 'high'   },
];

// ─── Smart Bin Rows ───────────────────────────────────────────────────────────
export const SMART_BIN_ROWS: SmartBinRow[] = [
  { binId: 'GG-001', location: 'HCMUT',         status: 'Online',      fillLevel: 65, lastUpdate: '1 min ago'  },
  { binId: 'GG-002', location: 'DownDown City',  status: 'Online',      fillLevel: 48, lastUpdate: '2 min ago'  },
  { binId: 'GG-003', location: 'BiosDome',       status: 'Nearly Full', fillLevel: 88, lastUpdate: '5 min ago'  },
  { binId: 'GG-004', location: 'Ryzel',          status: 'Offline',     fillLevel: 0,  lastUpdate: '1 hour ago' },
  { binId: 'GG-005', location: 'Sporting 24',    status: 'Online',      fillLevel: 30, lastUpdate: '3 min ago'  },
];

// ─── Smart Bins Full ──────────────────────────────────────────────────────────
export const SMART_BINS: SmartBin[] = [
  {
    binId: 'GG-001', location: 'HCMUT',
    coordinates: { lat: 10.7729, lng: 106.6580 },
    status: 'Online', fillLevel: 36,
    hardware: { camera: true, jetsonNano: true, esp32s3: true, servoMotors: true, aiModel: true },
    lastUpdate: '1 min ago',
  },
  {
    binId: 'GG-002', location: 'DownDown City',
    coordinates: { lat: 10.7780, lng: 106.6960 },
    status: 'Online', fillLevel: 48,
    hardware: { camera: true, jetsonNano: true, esp32s3: true, servoMotors: false, aiModel: true },
    lastUpdate: '2 min ago',
  },
  {
    binId: 'GG-003', location: 'BiosDome',
    coordinates: { lat: 10.7800, lng: 106.6620 },
    status: 'Nearly Full', fillLevel: 88,
    hardware: { camera: true, jetsonNano: true, esp32s3: true, servoMotors: true, aiModel: true },
    lastUpdate: '5 min ago',
  },
  {
    binId: 'GG-004', location: 'Ryzel',
    coordinates: { lat: 10.7650, lng: 106.6700 },
    status: 'Error', fillLevel: 10,
    hardware: { camera: false, jetsonNano: true, esp32s3: true, servoMotors: true, aiModel: false },
    lastUpdate: '1 hour ago',
  },
  {
    binId: 'GG-005', location: 'Sporting 24',
    coordinates: { lat: 10.7700, lng: 106.6850 },
    status: 'Offline', fillLevel: 30,
    hardware: { camera: true, jetsonNano: false, esp32s3: true, servoMotors: true, aiModel: true },
    lastUpdate: '3 min ago',
  },
];

// ─── Bin Overview ─────────────────────────────────────────────────────────────
export const BIN_OVERVIEW: BinOverviewItem[] = [
  { count: 42, label: 'Online',      color: Colors.binOnline,     total: 45 },
  { count: 1,  label: 'Offline',     color: Colors.binOffline,    total: 45 },
  { count: 1,  label: 'Error',       color: Colors.binError,      total: 45 },
  { count: 1,  label: 'Nearly Full', color: Colors.binNearlyFull, total: 45 },
];

// ─── Campaign ─────────────────────────────────────────────────────────────────
export const CAMPAIGN_STAT: CampaignStat = {
  participants: 12421,
  collected: 8241,
  recycled: '66.2%',
  trend: [
    { label: 'May 01', value: 200 },
    { label: 'May 08', value: 350 },
    { label: 'May 15', value: 420 },
    { label: 'May 22', value: 310 },
    { label: 'Jun 01', value: 580 },
    { label: 'Jun 15', value: 490 },
    { label: 'Jun 29', value: 720 },
  ],
};

// ─── Alert Cards ──────────────────────────────────────────────────────────────
export const ALERT_CARDS: AlertCardData[] = [
  { id: 'a1', severity: 'warning', title: 'Bin Alert',       message: 'GG-006 is nearly full'                          },
  { id: 'a2', severity: 'error',   title: 'Connectivity',    message: 'GG-004 is offline'                              },
  { id: 'a3', severity: 'info',    title: 'Maintenance',     message: 'Maintenance recommended for GG-002'             },
];

// ─── Accuracy Trend ───────────────────────────────────────────────────────────
export const ACCURACY_TREND: TrendPoint[] = [
  { label: 'Jan', value: 88 },
  { label: 'Feb', value: 90 },
  { label: 'Mar', value: 87 },
  { label: 'Apr', value: 93 },
  { label: 'May', value: 91 },
  { label: 'Jun', value: 95 },
  { label: 'Jul', value: 94 },
  { label: 'Aug', value: 95.3 },
];

// ─── Peak Usage ───────────────────────────────────────────────────────────────
export const PEAK_USAGE: TrendPoint[] = [
  { label: '6am',  value: 20  },
  { label: '8am',  value: 60  },
  { label: '10am', value: 45  },
  { label: '12pm', value: 90  },
  { label: '2pm',  value: 70  },
  { label: '4pm',  value: 80  },
  { label: '6pm',  value: 100 },
  { label: '8pm',  value: 55  },
];

// ─── Top Locations ────────────────────────────────────────────────────────────
export const TOP_LOCATIONS: TopLocation[] = [
  { name: 'HCMUT - Liners',   amount: '3,750', unit: 'kg' },
  { name: 'CircleK - Liners', amount: '5,000', unit: 'kg' },
  { name: 'BiosDome - Liner', amount: '2,000', unit: 'kg' },
  { name: 'HCMUT - Liners',   amount: '4,750', unit: 'kg' },
  { name: 'HCMUT - Liners',   amount: '3,500', unit: 'kg' },
];

// ─── Waste Distribution Trend ─────────────────────────────────────────────────
export const WASTE_DISTRIBUTION: TrendPoint[] = [
  { label: 'May 8',  value: 120 },
  { label: 'May 15', value: 180 },
  { label: 'May 22', value: 150 },
  { label: 'May 29', value: 220 },
  { label: 'Jun 5',  value: 195 },
  { label: 'Jun 12', value: 260 },
];

// ─── Daily Average ────────────────────────────────────────────────────────────
export const DAILY_AVERAGE: DailyAverage[] = [
  { label: 'Plastic', percentage: 44.8, color: Colors.dashPlastic },
  { label: 'Metal',   percentage: 26.2, color: Colors.dashMetal   },
  { label: 'Paper',   percentage: 21.6, color: Colors.dashPaper   },
  { label: 'Others',  percentage: 7.4,  color: Colors.dashOthers  },
];

// ─── Report History ───────────────────────────────────────────────────────────
export const REPORT_HISTORY: ReportHistoryItem[] = [
  { id: 'r1', name: 'Daily Report - Jun 24, 2025',            type: 'PDF',   period: 'May 24, 2025',        createdAt: 'May 24, 2025 10:00 AM',    size: '2.4 MB'  },
  { id: 'r2', name: 'Weekly Report – May 5 – Aug 24, 2024',   type: 'PDF',   period: 'May 5 – Aug 24',      createdAt: 'May 24, 2024 10:00 AM',    size: '5.6 MB'  },
  { id: 'r3', name: 'Monthly Report - Aug 2026',              type: 'PDF',   period: 'Aug 1 – Aug 30, 2023', createdAt: 'Aug 24, 2026 09:56 AM',   size: '7.9 MB'  },
  { id: 'r4', name: 'System Performance – GG-003',            type: 'Excel', period: 'Aug – Jan /02',        createdAt: 'Aug 24, 2026 09:56 AM',   size: '12.3 MB' },
  { id: 'r5', name: 'Waste Analysis Report',                  type: 'PDF',   period: 'Aug 1 – 8, 2023',     createdAt: 'Feb 15, 2023 02:00 PM',   size: '3.1 MB'  },
];
