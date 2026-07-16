/**
 * GreenGuard — API response mappers (backend DTO → UI view models)
 */
import type { AuthUserDto } from '@/types/auth.types';
import type { MemberTier, RankingTier, User, UserStats, ImpactStats } from '@/types/user.types';
import type { ApiReward, Reward, RewardStatus, TotalAmount } from '@/types/reward.types';
import type { CollectionPoint, PublicMachine } from '@/types/collection.types';
import { Colors } from '@/theme';

const TIER_LABELS: Record<string, MemberTier> = {
  green_member: 'Green Member',
  silver: 'Silver Member',
  gold: 'Gold Member',
  platinum: 'Platinum Member',
};

const RANKING_FROM_MEMBER: Record<string, RankingTier> = {
  green_member: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const BRAND_COLORS = ['#1565C0', '#E53935', '#2E7D32', '#F9A825', '#6A1B9A', '#00838F'];

function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: string })._id);
  }
  return String(value);
}

function partnerName(partnerId: ApiReward['partnerId']): string {
  if (partnerId && typeof partnerId === 'object' && 'name' in partnerId) {
    return partnerId.name;
  }
  return 'Partner';
}

function partnerLogo(partnerId: ApiReward['partnerId']): string | undefined {
  if (partnerId && typeof partnerId === 'object' && 'logoUrl' in partnerId) {
    return partnerId.logoUrl;
  }
  return undefined;
}

function formatExpiry(validUntil?: string): string {
  if (!validUntil) return 'No expiry';
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return validUntil;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function rewardStatus(reward: ApiReward): RewardStatus {
  if (reward.status !== 'active') return 'expired';
  if (reward.validUntil && new Date(reward.validUntil).getTime() < Date.now()) return 'expired';
  if (typeof reward.quantityRemaining === 'number' && reward.quantityRemaining <= 0) {
    return 'out_of_stock';
  }
  return 'claimable';
}

export function mapUser(dto: AuthUserDto): User {
  const tierKey = dto.membershipTier || 'green_member';
  const id = String((dto as any)._id || (dto as any).id || '');
  return {
    id,
    name: dto.displayName || 'Green User',
    username: dto.displayName || 'green_user',
    phoneNumber: dto.phoneNumber,
    avatarUrl: dto.avatar,
    className: dto.className,
    studentId: dto.studentId,
    totalPoints: dto.totalPoints ?? 0,
    lifetimeEarnedPoints: dto.lifetimeEarnedPoints ?? 0,
    lifetimeRedeemedPoints: dto.lifetimeRedeemedPoints ?? 0,
    memberTier: TIER_LABELS[tierKey] ?? 'Green Member',
    rankingTier: RANKING_FROM_MEMBER[tierKey] ?? 'Bronze',
    rankingPoints: dto.totalItems ?? 0,
    rankingMaxPoints: Math.max(100, Math.ceil(((dto.totalItems ?? 0) + 1) / 50) * 50),
    totalBottles: dto.totalBottles ?? 0,
    totalCans: dto.totalCans ?? 0,
    totalCarton: dto.totalCarton ?? 0,
    totalItems: dto.totalItems ?? 0,
    currentStreak: dto.currentStreak ?? 0,
  };
}

export function emptyUserStats(): UserStats {
  return {
    monthlyBottles: 0,
    yearlyBottles: 0,
    allTimeBottles: 0,
    monthlyCans: 0,
    monthlyCartons: 0,
    monthlyPoints: 0,
    allTimeCans: 0,
    allTimeCartons: 0,
    allTimePoints: 0,
    co2KgEstimate: 0,
  };
}

export function mapImpactToStats(impact: ImpactStats): UserStats {
  return {
    monthlyBottles: impact.month.bottles,
    yearlyBottles: impact.allTime.bottles,
    allTimeBottles: impact.allTime.bottles,
    monthlyCans: impact.month.cans,
    monthlyCartons: impact.month.cartons,
    monthlyPoints: impact.month.points,
    allTimeCans: impact.allTime.cans,
    allTimeCartons: impact.allTime.cartons,
    allTimePoints: impact.allTime.points,
    co2KgEstimate: impact.co2KgEstimate,
  };
}

export function mapReward(dto: ApiReward, index = 0): Reward {
  const brandId = idOf(dto.partnerId);
  return {
    id: dto._id,
    brandId,
    brandName: partnerName(dto.partnerId),
    brandLogoUrl: partnerLogo(dto.partnerId),
    brandColor: BRAND_COLORS[index % BRAND_COLORS.length],
    title: dto.name,
    description: dto.description,
    expiresAt: formatExpiry(dto.validUntil),
    status: rewardStatus(dto),
    pointsValue: dto.pointsRequired,
    valueVnd: dto.valueVnd,
    remainingQty: dto.quantityRemaining,
    terms: dto.terms ?? [],
    rewardType: dto.rewardType,
  };
}

export function mapImpactToTotalAmount(impact: ImpactStats): TotalAmount {
  const bottles = impact.allTime.bottles;
  const cans = impact.allTime.cans;
  const cartons = impact.allTime.cartons;
  const total = Math.max(1, bottles + cans + cartons);
  const totalKg = Number((impact.co2KgEstimate / 0.034 * 0.02).toFixed(2)) || Number((total * 0.02).toFixed(2));

  return {
    totalKg,
    breakdown: [
      {
        label: 'Plastic',
        percentage: Math.round((bottles / total) * 100),
        color: Colors.primary,
      },
      {
        label: 'Metal',
        percentage: Math.round((cans / total) * 100),
        color: Colors.accent,
      },
      {
        label: 'Carton',
        percentage: Math.round((cartons / total) * 100),
        color: Colors.info,
      },
    ].filter((b) => b.percentage > 0),
  };
}

/** Default campus coords (HCMUT) when machine has no geo */
const DEFAULT_LAT = 10.7729;
const DEFAULT_LNG = 106.658;

export function mapMachineToCollectionPoint(machine: PublicMachine, index = 0): CollectionPoint {
  return {
    id: machine._id,
    name: machine.name || machine.machineCode,
    brandId: 'greenguard',
    brandName: 'GreenGuard',
    brandColor: BRAND_COLORS[index % BRAND_COLORS.length],
    address: machine.locationName,
    latitude: machine.latitude ?? DEFAULT_LAT + index * 0.002,
    longitude: machine.longitude ?? DEFAULT_LNG + index * 0.002,
    isActive: machine.status === 'online' || machine.status === 'offline' || machine.status === 'maintenance',
    locationType: machine.locationType,
    status: machine.status,
    machineCode: machine.machineCode,
  };
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error || typeof error !== 'object') return fallback;
  const err = error as {
    code?: string;
    message?: string;
    response?: { data?: { message?: string }; status?: number };
  };

  if (!err.response) {
    if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
      return 'Cannot reach the server. Check that the backend is running and EXPO_PUBLIC_API_URL points to your computer (not localhost on a physical phone).';
    }
    if (err.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }
  }

  return err.response?.data?.message || err.message || fallback;
}
