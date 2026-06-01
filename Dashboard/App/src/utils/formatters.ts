import type { DetectedType, SortingStatus, MachineState } from '@/types';
import { OFFLINE_THRESHOLD_MS } from './constants';

// ─── Date / Time ──────────────────────────────────────────────────────────────

/** Hiện giờ theo múi giờ Việt Nam */
export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** "X seconds / minutes / hours ago" */
export const formatTimeAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1_000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

// ─── Waste type display ───────────────────────────────────────────────────────

const WASTE_TYPE_LABELS: Record<DetectedType, string> = {
  plastic_bottle: 'Plastic Bottle',
  aluminum_can:   'Aluminum Can',
  paper_carton:   'Paper Carton',
  unknown_object: 'Unknown',
};

export const formatWasteType = (type: DetectedType): string =>
  WASTE_TYPE_LABELS[type] ?? type;

// ─── Confidence ───────────────────────────────────────────────────────────────

/** 0.91 → "91.0%" */
export const formatConfidence = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

// ─── Status ───────────────────────────────────────────────────────────────────

export const sortingStatusLabel: Record<SortingStatus, string> = {
  success: 'Success',
  failed:  'Failed',
  unknown: 'Unknown',
};

export const machineStateLabel: Record<MachineState, string> = {
  IDLE:    'Idle',
  SORTING: 'Sorting',
  SYNCING: 'Syncing',
  ERROR:   'Error',
};

// ─── Online / Offline ─────────────────────────────────────────────────────────

/** Machine ONLINE nếu lastSeenAt < OFFLINE_THRESHOLD_MS trước */
export const isOnline = (lastSeenAt: string | null): boolean => {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < OFFLINE_THRESHOLD_MS;
};
