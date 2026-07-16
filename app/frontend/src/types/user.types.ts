/**
 * GreenGuard — TypeScript Types: User
 */

export type MemberTier = 'Green Member' | 'Silver Member' | 'Gold Member' | 'Platinum Member';
export type RankingTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface User {
  id: string;
  name: string;
  username: string;
  phoneNumber: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  location?: string;
  className?: string;
  studentId?: string;
  totalPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  memberTier: MemberTier;
  rankingTier: RankingTier;
  rankingPoints: number;
  rankingMaxPoints: number;
  totalBottles: number;
  totalCans: number;
  totalCarton: number;
  totalItems: number;
  currentStreak: number;
}

export interface UserStats {
  monthlyBottles: number;
  yearlyBottles: number;
  allTimeBottles: number;
  monthlyCans: number;
  monthlyCartons: number;
  monthlyPoints: number;
  allTimeCans: number;
  allTimeCartons: number;
  allTimePoints: number;
  co2KgEstimate: number;
}

export interface ImpactStats {
  month: { bottles: number; cans: number; cartons: number; points: number };
  allTime: { bottles: number; cans: number; cartons: number; items: number; points: number };
  co2KgEstimate: number;
}

export interface PointTransaction {
  _id: string;
  userId: string;
  type: 'earn' | 'redeem' | 'refund' | 'bonus' | 'adjustment';
  points: number;
  source: string;
  description?: string;
  contributionSessionId?: string;
  rewardId?: string;
  balanceAfter: number;
  createdAt: string;
  updatedAt?: string;
}

export interface HistoryEntry {
  id: string;
  items: HistoryItem[];
  createdAt: string;
}

export interface HistoryItem {
  type: string;
  quantity: number;
  pointsEarned: number;
}

export interface UserSummary {
  user: User;
  recentTransactions: PointTransaction[];
  impact: ImpactStats;
}
