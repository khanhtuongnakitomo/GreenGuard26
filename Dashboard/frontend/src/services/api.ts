/**
 * Dashboard API client — connects to Dashboard Backend BFF
 */

import {
  DEMO_IMPACT,
  DEMO_LIVE_FEED,
  DEMO_MACHINES,
  DEMO_OVERVIEW,
  DEMO_QUALITY,
} from './demoData';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3003';

// The presentation build is useful without a running backend. Set this to
// "false" when the dashboard should read from the live BFF instead.
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

export interface OverviewData {
  todayDetections: number;
  acceptRate: number | null;
  avgConfidence: number | null;
  binsOnline: string;
  avgFps: number | null;
  pendingSync: number | null;
  unclaimedSessions?: number;
  purityRate: number | null;
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
  latencyP50: number | null;
  latencyP95: number | null;
}

export interface ImpactData {
  byMonth: Array<{ month: string; items: number; kgPerType: Record<'pet_clean' | 'pet_bad' | 'aluminum', number> }>;
  co2SavedKg: number;
  waterSavedL: number;
  electricityKwh: number;
  timeZone?: 'UTC';
  periodBasis?: 'createdAt';
  undatedItems?: number;
}

export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function fetchOverview(range = 'today', signal?: AbortSignal): Promise<OverviewData> {
  if (DEMO_MODE) return DEMO_OVERVIEW;
  return fetchJson(`/api/dashboard/overview?range=${encodeURIComponent(range)}`, signal);
}
export async function fetchLiveFeed(limit = 50, signal?: AbortSignal): Promise<LiveFeedItem[]> {
  if (DEMO_MODE) return DEMO_LIVE_FEED.slice(0, limit);
  return fetchJson(`/api/dashboard/live?limit=${limit}`, signal);
}
export async function fetchQuality(signal?: AbortSignal): Promise<QualityData> {
  if (DEMO_MODE) return DEMO_QUALITY;
  return fetchJson('/api/dashboard/quality', signal);
}
export async function fetchImpact(signal?: AbortSignal): Promise<ImpactData> {
  if (DEMO_MODE) return DEMO_IMPACT;
  return fetchJson('/api/dashboard/impact', signal);
}
export async function fetchMachines(signal?: AbortSignal): Promise<any[]> {
  if (DEMO_MODE) return DEMO_MACHINES;
  return fetchJson('/api/machines', signal);
}
