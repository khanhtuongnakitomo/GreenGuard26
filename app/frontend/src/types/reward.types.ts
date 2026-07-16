/**
 * GreenGuard — TypeScript Types: Reward
 */

export type RewardStatus = 'claimable' | 'claimed' | 'expired' | 'out_of_stock';
export type TaskStatus = 'in_progress' | 'completed';

export interface PartnerInfo {
  _id: string;
  name: string;
  type?: string;
  logoUrl?: string;
  description?: string;
}

export interface ApiReward {
  _id: string;
  partnerId: PartnerInfo | string;
  name: string;
  description?: string;
  rewardType: string;
  pointsRequired: number;
  valueVnd?: number;
  quantityTotal?: number;
  quantityRemaining?: number;
  validFrom?: string;
  validUntil?: string;
  terms?: string[];
  status: string;
}

export interface Reward {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;
  title: string;
  description?: string;
  expiresAt: string;
  status: RewardStatus;
  pointsValue: number;
  valueVnd?: number;
  remainingQty?: number;
  terms: string[];
  rewardType: string;
}

export interface Task {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;
  title: string;
  targetPoints: number;
  currentPoints: number;
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

export interface UserVoucher {
  _id: string;
  userId: string;
  rewardId: ApiReward | string;
  partnerId: PartnerInfo | string;
  redeemCode: string;
  pointsUsed: number;
  status: 'unused' | 'used' | 'expired' | 'cancelled';
  issuedAt: string;
  usedAt?: string;
  expiresAt: string;
  usedLocation?: string;
}

export interface RedeemResult {
  reward: ApiReward;
  transaction: unknown;
  voucher: UserVoucher;
  qrToken: string;
}
