/**
 * GreenGuard — Zustand User Store
 */
import { create } from 'zustand';
import { User, UserStats } from '@/types/user.types';
import { userService } from '@/services/user.service';
import { mapImpactToStats, mapUser } from '@/utils/mappers';

interface UserState {
  user: User | null;
  stats: UserStats | null;
  setUser: (user: User) => void;
  setStats: (stats: UserStats) => void;
  clearUser: () => void;
  refreshProfile: () => Promise<boolean>;
  updateUser: (partialUser: Partial<User>) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  stats: null,

  setUser: (user) => set({ user }),
  setStats: (stats) => set({ stats }),
  clearUser: () => set({ user: null, stats: null }),

  refreshProfile: async () => {
    try {
      const summary = await userService.getSummary();
      set({
        user: summary.user,
        stats: mapImpactToStats(summary.impact),
      });
      return true;
    } catch {
      return false;
    }
  },

  updateUser: async (partialUser) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const dto = await userService.updateProfile({
      displayName: partialUser.name,
      className: partialUser.className,
      studentId: partialUser.studentId,
      avatar: partialUser.avatarUrl,
    });

    set({ user: mapUser(dto) });
  },
}));
