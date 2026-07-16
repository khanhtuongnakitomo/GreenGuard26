/**
 * GreenGuard — Reward & Wallet Service
 */
import api from './api';
import type { ApiReward, RedeemResult, Reward, TotalAmount, UserVoucher } from '@/types/reward.types';
import type { ImpactStats } from '@/types/user.types';
import { mapImpactToTotalAmount, mapReward } from '@/utils/mappers';
import { userService } from './user.service';

export const rewardService = {
  async getRewards(): Promise<Reward[]> {
    const { data } = await api.get<ApiReward[]>('/rewards');
    return data.map((r, i) => mapReward(r, i));
  },

  async getHomeRewards(): Promise<Reward[]> {
    const rewards = await this.getRewards();
    return rewards.filter((r) => r.status === 'claimable').slice(0, 5);
  },

  async getRewardById(rewardId: string): Promise<Reward> {
    const { data } = await api.get<ApiReward>(`/rewards/${rewardId}`);
    return mapReward(data);
  },

  async getTotalAmount(_period?: string): Promise<TotalAmount> {
    const impact: ImpactStats = await userService.getImpact();
    return mapImpactToTotalAmount(impact);
  },

  async getTasks(): Promise<
    Array<{
      id: string;
      brandId: string;
      brandName: string;
      title: string;
      targetPoints: number;
      currentPoints: number;
      expiresAt: string;
      status: 'in_progress' | 'completed';
    }>
  > {
    const { data } = await api.get('/milestones/me');
    const rows = Array.isArray(data) ? data : [];

    return rows.map((row: any) => ({
      id: String(row.milestone?._id ?? row._id ?? Math.random()),
      brandId: 'milestone',
      brandName: 'Milestone',
      title: row.milestone?.name ?? row.name ?? 'Milestone',
      targetPoints: row.milestone?.targetValue ?? row.targetValue ?? 0,
      currentPoints: row.currentValue ?? 0,
      expiresAt: '',
      status: row.achieved ? 'completed' : 'in_progress',
    }));
  },

  async claimReward(rewardId: string): Promise<RedeemResult> {
    const { data } = await api.post<RedeemResult>(`/rewards/${rewardId}/redeem`);
    return data;
  },

  async getWallet(): Promise<UserVoucher[]> {
    const { data } = await api.get<UserVoucher[]>('/wallet');
    return data;
  },

  async getVoucher(voucherId: string): Promise<UserVoucher> {
    const { data } = await api.get<UserVoucher>(`/wallet/${voucherId}`);
    return data;
  },
};
