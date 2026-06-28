/**
 * GreenGuard — TypeScript Types: User
 */

export type MemberTier = 'Green Member' | 'Silver Member' | 'Gold Member' | 'Platinum Member';
export type RankingTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  dateOfBirth: string;    // "17.12.2007"
  location: string;       // "Ho Chi Minh City, Vietnam"
  totalPoints: number;
  memberTier: MemberTier;
  rankingTier: RankingTier;
  rankingPoints: number;
  rankingMaxPoints: number;
}

export interface UserStats {
  monthlyBottles: number;
  yearlyBottles: number;
  allTimeBottles: number;
  monthlyCans: number;
}

export interface HistoryEntry {
  id: string;
  items: HistoryItem[];
  createdAt: string;  // ISO date string
}

export interface HistoryItem {
  type: string;       // "Plastic Bottles", "Metal Cans"
  quantity: number;
  pointsEarned: number;
}
