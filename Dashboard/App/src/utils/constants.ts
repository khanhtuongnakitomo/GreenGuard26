// ─── Constants ───────────────────────────────────────────────────────────────

export const MACHINE_ID = import.meta.env.VITE_MACHINE_ID as string || 'BK_BIN_01';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:3001';

export const WASTE_TYPES = [
  'plastic_bottle',
  'aluminum_can',
  'paper_carton',
  'unknown_object',
] as const;

export const BINS = ['bin_1', 'bin_2', 'bin_3', 'unknown_bin'] as const;

export const SORTING_STATUSES = ['success', 'failed', 'unknown'] as const;

export const MACHINE_STATES = ['IDLE', 'SORTING', 'SYNCING', 'ERROR'] as const;

/** Polling intervals (ms) theo architecture doc */
export const POLL_INTERVALS = {
  summary:  5_000,
  latest:   3_000,
  machine:  5_000,
  history: 10_000,
} as const;

/** Thời gian không có heartbeat tính là OFFLINE (ms) */
export const OFFLINE_THRESHOLD_MS = 30_000;
