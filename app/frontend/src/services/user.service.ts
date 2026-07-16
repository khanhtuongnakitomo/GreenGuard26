/**
 * GreenGuard — User Service
 */
import api from './api';
import type { AuthUserDto } from '@/types/auth.types';
import type { ImpactStats, PointTransaction, UserSummary } from '@/types/user.types';
import { mapImpactToStats, mapUser } from '@/utils/mappers';

export const userService = {
  async getMe(): Promise<AuthUserDto> {
    const { data } = await api.get<AuthUserDto>('/users/me');
    return data;
  },

  async getSummary(): Promise<UserSummary> {
    const { data } = await api.get<{
      user: AuthUserDto;
      recentTransactions: PointTransaction[];
      impact: ImpactStats;
    }>('/users/me/summary');

    return {
      user: mapUser(data.user),
      recentTransactions: data.recentTransactions,
      impact: data.impact,
    };
  },

  async getImpact(): Promise<ImpactStats> {
    const { data } = await api.get<ImpactStats>('/users/me/impact');
    return data;
  },

  async getHistory(): Promise<PointTransaction[]> {
    const { data } = await api.get<PointTransaction[]>('/users/me/history');
    return data;
  },

  async getStats() {
    const impact = await this.getImpact();
    return mapImpactToStats(impact);
  },

  async updateProfile(updates: {
    displayName?: string;
    avatar?: string;
    className?: string;
    studentId?: string;
  }): Promise<AuthUserDto> {
    const { data } = await api.patch<AuthUserDto>('/users/me', updates);
    return data;
  },

  async getMilestones() {
    const { data } = await api.get('/users/me/milestones');
    return data;
  },
};
