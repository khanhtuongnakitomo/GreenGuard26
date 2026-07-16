/**
 * GreenGuard — Legacy mock data (kept for reference; app uses live API)
 */
import type { CollectionPoint } from '@/types/collection.types';
import type { HistoryEntry, User, UserStats } from '@/types/user.types';
import type { Reward, Task, TotalAmount } from '@/types/reward.types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Demo User',
  username: 'demo',
  phoneNumber: '0900000000',
  totalPoints: 0,
  lifetimeEarnedPoints: 0,
  lifetimeRedeemedPoints: 0,
  memberTier: 'Green Member',
  rankingTier: 'Bronze',
  rankingPoints: 0,
  rankingMaxPoints: 100,
  totalBottles: 0,
  totalCans: 0,
  totalCarton: 0,
  totalItems: 0,
  currentStreak: 0,
};

export const MOCK_USER_STATS: UserStats = {
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

export const MOCK_HISTORY: HistoryEntry[] = [];

export const MOCK_REWARDS: Reward[] = [];
export const MOCK_HOME_REWARDS: Reward[] = [];
export const MOCK_TASKS: Task[] = [];
export const MOCK_REWARD_TASKS_PROGRESS: Array<{ label: string; current: number; target: number }> = [];
export const MOCK_TOTAL_AMOUNT: TotalAmount = { totalKg: 0, breakdown: [] };
export const MOCK_COLLECTION_POINTS: CollectionPoint[] = [];
