/**
 * GreenGuard — TypeScript Types: Reward
 */

export type RewardStatus = 'claimable' | 'claimed' | 'expired';
export type TaskStatus = 'in_progress' | 'completed';

export interface Reward {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;       // e.g. "#E53935" for CocaCola
  title: string;             // "1 CocaCola Bottle"
  description?: string;
  expiresAt: string;         // "30 Jun 2026"
  status: RewardStatus;
  pointsValue?: number;      // for point-based rewards like "2k"
}

export interface Task {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;
  title: string;             // "Obtain 100pts"
  targetPoints: number;      // 100
  currentPoints: number;     // 80
  expiresAt: string;
  status: TaskStatus;
}

export interface WasteBreakdown {
  label: string;
  percentage: number;
  color: string;
}

export interface TotalAmount {
  totalKg: number;
  breakdown: WasteBreakdown[];
}
