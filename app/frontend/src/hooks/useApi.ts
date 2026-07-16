/**
 * GreenGuard — React Query hooks for live API data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { rewardService } from '@/services/reward.service';
import { collectionService } from '@/services/collection.service';
import { leaderboardService } from '@/services/leaderboard.service';
import { useUserStore } from '@/store/userStore';
import { mapImpactToStats } from '@/utils/mappers';
import { useAuthStore } from '@/store/authStore';

export const queryKeys = {
  summary: ['user', 'summary'] as const,
  impact: ['user', 'impact'] as const,
  history: ['user', 'history'] as const,
  rewards: ['rewards'] as const,
  wallet: ['wallet'] as const,
  milestones: ['milestones', 'me'] as const,
  machines: ['machines', 'public'] as const,
  leaderboard: (period: string) => ['leaderboard', period] as const,
};

export function useUserSummary() {
  const setUser = useUserStore((s) => s.setUser);
  const setStats = useUserStore((s) => s.setStats);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.summary,
    enabled: isAuthenticated,
    retry: 1,
    queryFn: async () => {
      const summary = await userService.getSummary();
      setUser(summary.user);
      setStats(mapImpactToStats(summary.impact));
      return summary;
    },
  });
}

export function useImpact() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.impact,
    enabled: isAuthenticated,
    queryFn: () => userService.getImpact(),
  });
}

export function useHistory() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.history,
    enabled: isAuthenticated,
    queryFn: () => userService.getHistory(),
  });
}

export function useRewards() {
  return useQuery({
    queryKey: queryKeys.rewards,
    queryFn: () => rewardService.getRewards(),
  });
}

export function useHomeRewards() {
  return useQuery({
    queryKey: [...queryKeys.rewards, 'home'],
    queryFn: () => rewardService.getHomeRewards(),
  });
}

export function useWallet() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.wallet,
    enabled: isAuthenticated,
    queryFn: () => rewardService.getWallet(),
  });
}

export function useMilestoneTasks() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.milestones,
    enabled: isAuthenticated,
    queryFn: () => rewardService.getTasks(),
  });
}

export function useCollectionPoints(query?: string) {
  return useQuery({
    queryKey: [...queryKeys.machines, query ?? ''],
    queryFn: () => collectionService.getCollectionPoints(query),
  });
}

export function useLeaderboard(period: 'week' | 'month' | 'year' | 'all' = 'month') {
  return useQuery({
    queryKey: queryKeys.leaderboard(period),
    queryFn: () => leaderboardService.getUsers(period),
  });
}

export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => rewardService.claimReward(rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.summary });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.rewards });
      qc.invalidateQueries({ queryKey: queryKeys.history });
      qc.invalidateQueries({ queryKey: queryKeys.impact });
    },
  });
}

export function useInvalidateUserData() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['user'] });
    qc.invalidateQueries({ queryKey: queryKeys.rewards });
    qc.invalidateQueries({ queryKey: queryKeys.wallet });
    qc.invalidateQueries({ queryKey: queryKeys.milestones });
  };
}
