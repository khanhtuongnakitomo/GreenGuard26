import type {
  ImpactData,
  LiveFeedItem,
  OverviewData,
  QualityData,
} from './api';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const DEMO_OVERVIEW: OverviewData = {
  todayDetections: 128,
  acceptRate: 91.4,
  avgConfidence: 0.94,
  binsOnline: '4/5',
  avgFps: 28.7,
  pendingSync: 2,
  purityRate: 91.7,
  wasteBreakdown: {
    pet_clean: 84,
    pet_bad: 23,
    aluminum: 21,
  },
  classificationTrend: [
    { label: '08:00', value: 8 },
    { label: '09:00', value: 14 },
    { label: '10:00', value: 19 },
    { label: '11:00', value: 27 },
    { label: '12:00', value: 22 },
    { label: '13:00', value: 31 },
    { label: '14:00', value: 38 },
    { label: '15:00', value: 34 },
    { label: '16:00', value: 43 },
    { label: '17:00', value: 51 },
    { label: '18:00', value: 47 },
  ],
};

export const DEMO_LIVE_FEED: LiveFeedItem[] = [
  { kind: 'detection', time: minutesAgo(1), machineCode: '0001', detectedType: 'pet_clean', confidence: 0.98, decision: 'accept' },
  { kind: 'claim', time: minutesAgo(3), machineCode: '0003', userName: 'Nguyễn Minh Anh', points: 20, items: [{ itemType: 'pet_clean', quantity: 2 }] },
  { kind: 'detection', time: minutesAgo(5), machineCode: '0002', detectedType: 'aluminum', confidence: 0.96, decision: 'accept' },
  { kind: 'detection', time: minutesAgo(7), machineCode: '0004', detectedType: 'pet_bad', confidence: 0.89, decision: 'reject' },
  { kind: 'claim', time: minutesAgo(10), machineCode: '0001', userName: 'Trần Gia Huy', points: 38, items: [{ itemType: 'aluminum', quantity: 2 }, { itemType: 'pet_clean', quantity: 1 }] },
  { kind: 'detection', time: minutesAgo(13), machineCode: '0003', detectedType: 'pet_clean', confidence: 0.94, decision: 'accept' },
  { kind: 'detection', time: minutesAgo(17), machineCode: '0001', detectedType: 'reject', confidence: 0.62, decision: 'reject' },
  { kind: 'claim', time: minutesAgo(21), machineCode: '0002', userName: 'Lê Thuỳ Dương', points: 50, items: [{ itemType: 'pet_clean', quantity: 5 }] },
  { kind: 'detection', time: minutesAgo(25), machineCode: '0004', detectedType: 'pet_clean', confidence: 0.97, decision: 'accept' },
  { kind: 'detection', time: minutesAgo(29), machineCode: '0001', detectedType: 'aluminum', confidence: 0.92, decision: 'accept' },
];

export const DEMO_MACHINES = [
  { _id: 'demo-0001', machineCode: '0001', status: 'online', lastSeenAt: minutesAgo(1), bins: [{ capacityPercent: 68 }] },
  { _id: 'demo-0002', machineCode: '0002', status: 'online', lastSeenAt: minutesAgo(2), bins: [{ capacityPercent: 44 }] },
  { _id: 'demo-0003', machineCode: '0003', status: 'online', lastSeenAt: minutesAgo(1), bins: [{ capacityPercent: 82 }] },
  { _id: 'demo-0004', machineCode: '0004', status: 'online', lastSeenAt: minutesAgo(4), bins: [{ capacityPercent: 37 }] },
  { _id: 'demo-0005', machineCode: '0005', status: 'offline', lastSeenAt: minutesAgo(48), bins: [{ capacityPercent: 91 }] },
];

export const DEMO_QUALITY: QualityData = {
  confidenceHistogram: [
    { bucket: '0.50–0.60', count: 4 },
    { bucket: '0.60–0.70', count: 7 },
    { bucket: '0.70–0.80', count: 13 },
    { bucket: '0.80–0.90', count: 29 },
    { bucket: '0.90–1.00', count: 75 },
  ],
  fpsSeries: [
    { time: '08:00', fps: 27.8 },
    { time: '10:00', fps: 28.4 },
    { time: '12:00', fps: 29.1 },
    { time: '14:00', fps: 28.6 },
    { time: '16:00', fps: 28.9 },
    { time: '18:00', fps: 28.7 },
  ],
  latencyP50: 31,
  latencyP95: 48,
};

export const DEMO_IMPACT: ImpactData = {
  byMonth: [
    { month: 'Apr', items: 2840, kgPerType: { pet_clean: 51, pet_bad: 14, aluminum: 18 } },
    { month: 'May', items: 3960, kgPerType: { pet_clean: 72, pet_bad: 21, aluminum: 24 } },
    { month: 'Jun', items: 4780, kgPerType: { pet_clean: 89, pet_bad: 23, aluminum: 29 } },
    { month: 'Jul', items: 5620, kgPerType: { pet_clean: 104, pet_bad: 28, aluminum: 35 } },
    { month: 'Aug', items: 6340, kgPerType: { pet_clean: 118, pet_bad: 31, aluminum: 39 } },
  ],
  co2SavedKg: 486.2,
  waterSavedL: 12840,
  electricityKwh: 926.5,
};
