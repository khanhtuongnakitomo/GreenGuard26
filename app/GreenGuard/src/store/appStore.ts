/**
 * GreenGuard — Zustand App Store (global UI state)
 */
import { create } from 'zustand';

interface AppState {
  // Global loading overlay
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // Active time filter on Rewards screen
  rewardsTimeFilter: '1day' | '1month' | 'alltime';
  setRewardsTimeFilter: (filter: '1day' | '1month' | 'alltime') => void;

  // Active filter on Task List screen
  taskFilter: string;
  setTaskFilter: (filter: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isGlobalLoading: false,
  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),

  rewardsTimeFilter: '1month',
  setRewardsTimeFilter: (filter) => set({ rewardsTimeFilter: filter }),

  taskFilter: 'All',
  setTaskFilter: (filter) => set({ taskFilter: filter }),
}));
