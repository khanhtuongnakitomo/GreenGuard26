/**
 * GreenGuard — Zustand Auth Store
 */
import { create } from 'zustand';
import { storage } from '@/utils/storage';
import { authService } from '@/services/auth.service';
import { emptyUserStats, mapUser } from '@/utils/mappers';
import { useUserStore } from './userStore';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userId: string | null;

  initialize: () => Promise<void>;
  login: (accessToken: string, refreshToken: string, userId: string, userDto?: unknown) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,
  userId: null,

  initialize: async () => {
    try {
      const token = await storage.getAccessToken();
      const userId = await storage.getUserId();

      if (token && userId) {
        try {
          const me = await authService.me();
          useUserStore.getState().setUser(mapUser(me));
          if (!useUserStore.getState().stats) {
            useUserStore.getState().setStats(emptyUserStats());
          }
          set({
            isAuthenticated: true,
            accessToken: token,
            userId: String(me._id || userId),
            isLoading: false,
          });
          return;
        } catch (err: any) {
          const status = err?.response?.status;
          // Only wipe session on auth failures — keep tokens if server is temporarily unreachable
          if (status === 401 || status === 403) {
            await storage.clearAuth();
          } else {
            // Keep session but without profile — home can retry
            useUserStore.getState().setUser({
              id: userId,
              name: 'Green User',
              username: 'green_user',
              phoneNumber: '',
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
            });
            useUserStore.getState().setStats(emptyUserStats());
            set({
              isAuthenticated: true,
              accessToken: token,
              userId,
              isLoading: false,
            });
            return;
          }
        }
      }

      set({
        isAuthenticated: false,
        accessToken: null,
        userId: null,
        isLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  login: async (accessToken, refreshToken, userId, userDto) => {
    await storage.setAccessToken(accessToken);
    await storage.setRefreshToken(refreshToken);
    await storage.setUserId(String(userId));

    if (userDto) {
      useUserStore.getState().setUser(mapUser(userDto as any));
    } else {
      try {
        const me = await authService.me();
        useUserStore.getState().setUser(mapUser(me));
      } catch {
        // summary query will fill profile later
      }
    }

    if (!useUserStore.getState().stats) {
      useUserStore.getState().setStats(emptyUserStats());
    }

    set({ isAuthenticated: true, accessToken, userId: String(userId) });
  },

  logout: async () => {
    try {
      await authService.signOut();
    } catch {
      // ignore
    }
    await storage.clearAuth();
    useUserStore.getState().clearUser();
    set({ isAuthenticated: false, accessToken: null, userId: null });
  },
}));
