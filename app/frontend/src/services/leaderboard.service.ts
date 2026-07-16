/**
 * GreenGuard — Leaderboard Service
 */
import api from './api';

export interface LeaderboardUser {
  _id: string;
  displayName: string;
  totalPoints?: number;
  lifetimeEarnedPoints?: number;
  faculty?: string;
  totalBottles?: number;
}

export const leaderboardService = {
  async getUsers(period: 'week' | 'month' | 'year' | 'all' = 'month'): Promise<LeaderboardUser[]> {
    const { data } = await api.get('/leaderboard/users', { params: { period } });
    return Array.isArray(data) ? data : data?.users ?? [];
  },
};
