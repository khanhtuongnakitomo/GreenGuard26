/**
 * Dashboard API client — connects to Dashboard Backend BFF
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3003';

export interface OverviewData {
  todayDetections: number;
  acceptRate: number;
  avgConfidence: number;
  binsOnline: string;
  avgFps: number;
  pendingSync: number;
  purityRate: number;
  wasteBreakdown: {
    pet_clean: number;
    pet_bad: number;
    aluminum: number;
  };
  classificationTrend: Array<{ label: string; value: number }>;
}

export interface LiveFeedItem {
  kind: 'detection' | 'claim';
  time: string;
  machineCode: string;
  detectedType?: 'pet_clean' | 'pet_bad' | 'aluminum' | 'reject';
  confidence?: number;
  decision?: 'accept' | 'reject';
  snapshotUrl?: string;
  userName?: string;
  points?: number;
  items?: Array<{ itemType: string; quantity: number }>;
}

export interface QualityData {
  confidenceHistogram: Array<{ bucket: string; count: number }>;
  fpsSeries: Array<{ time: string; fps: number }>;
  latencyP50: number;
  latencyP95: number;
}

export interface ImpactData {
  byMonth: Array<{ month: string; items: number; kgPerType: any }>;
  co2SavedKg: number;
  waterSavedL: number;
  electricityKwh: number;
}

export async function fetchOverview(range = 'today'): Promise<OverviewData> {
  const res = await fetch(`${BASE_URL}/api/dashboard/overview?range=${range}`);
  if (!res.ok) throw new Error(`Overview fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchLiveFeed(limit = 50): Promise<LiveFeedItem[]> {
  const res = await fetch(`${BASE_URL}/api/dashboard/live?limit=${limit}`);
  if (!res.ok) throw new Error(`Live feed fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchQuality(): Promise<QualityData> {
  const res = await fetch(`${BASE_URL}/api/dashboard/quality`);
  if (!res.ok) throw new Error(`Quality fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchImpact(): Promise<ImpactData> {
  const res = await fetch(`${BASE_URL}/api/dashboard/impact`);
  if (!res.ok) throw new Error(`Impact fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMachines(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/machines`);
  if (!res.ok) throw new Error(`Machines fetch failed: ${res.status}`);
  return res.json();
}
