/**
 * GreenGuard — Reward Service
 */
import api from './api';
import { Reward, Task, TotalAmount } from '@/types/reward.types';
import {
  MOCK_REWARDS,
  MOCK_TASKS,
  MOCK_TOTAL_AMOUNT,
  MOCK_HOME_REWARDS,
} from '@/constants/mockData';

const USE_MOCK = true;

export const rewardService = {
  async getRewards(filter?: string): Promise<Reward[]> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      if (filter && filter !== 'All') {
        return MOCK_REWARDS.filter((r) => r.brandName === filter);
      }
      return MOCK_REWARDS;
    }
    const { data } = await api.get<Reward[]>('/rewards', { params: { filter } });
    return data;
  },

  async getHomeRewards(): Promise<Reward[]> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      return MOCK_HOME_REWARDS;
    }
    const { data } = await api.get<Reward[]>('/rewards/home');
    return data;
  },

  async getTasks(brandId?: string): Promise<Task[]> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      if (brandId) {
        return MOCK_TASKS.filter((t) => t.brandId === brandId);
      }
      return MOCK_TASKS;
    }
    const { data } = await api.get<Task[]>('/tasks', { params: { brandId } });
    return data;
  },

  async getTotalAmount(period: '1day' | '1month' | 'alltime'): Promise<TotalAmount> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      return MOCK_TOTAL_AMOUNT;
    }
    const { data } = await api.get<TotalAmount>('/rewards/total', { params: { period } });
    return data;
  },

  async claimReward(rewardId: string): Promise<void> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 800));
      return;
    }
    await api.post(`/rewards/${rewardId}/claim`);
  },
};
