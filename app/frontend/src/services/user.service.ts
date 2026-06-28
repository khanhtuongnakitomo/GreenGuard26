/**
 * GreenGuard — User Service
 */
import api from './api';
import { User, UserStats, HistoryEntry } from '@/types/user.types';
import { MOCK_USER, MOCK_USER_STATS, MOCK_HISTORY } from '@/constants/mockData';

const USE_MOCK = true;

export const userService = {
  async getProfile(): Promise<User> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      return MOCK_USER;
    }
    const { data } = await api.get<User>('/user/profile');
    return data;
  },

  async getStats(): Promise<UserStats> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      return MOCK_USER_STATS;
    }
    const { data } = await api.get<UserStats>('/user/stats');
    return data;
  },

  async getHistory(): Promise<HistoryEntry[]> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      return MOCK_HISTORY;
    }
    const { data } = await api.get<HistoryEntry[]>('/user/history');
    return data;
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 800));
      return { ...MOCK_USER, ...updates };
    }
    const { data } = await api.put<User>('/user/profile', updates);
    return data;
  },
};
