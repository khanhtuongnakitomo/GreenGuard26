/**
 * GreenGuard — Zustand Auth Store
 */
import { create } from 'zustand';
import { storage } from '@/utils/storage';
import { useUserStore } from './userStore';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userId: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (accessToken: string, refreshToken: string, userId: string) => Promise<void>;
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
        const userLoaded = await useUserStore.getState().loadUser(userId);
        
        if (!userLoaded) {
          // If the mock db doesn't have the user anymore (cleared storage), 
          // we must clear auth tokens to prevent blank screens.
          await storage.clearAuth();
          set({
            isAuthenticated: false,
            accessToken: null,
            userId: null,
            isLoading: false,
          });
          return;
        }
      }
      
      set({
        isAuthenticated: !!token,
        accessToken: token,
        userId,
        isLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  login: async (accessToken, refreshToken, userId) => {
    await storage.setAccessToken(accessToken);
    await storage.setRefreshToken(refreshToken);
    await storage.setUserId(userId);
    
    await useUserStore.getState().loadUser(userId);
    
    set({ isAuthenticated: true, accessToken, userId });
  },

  logout: async () => {
    await storage.clearAuth();
    useUserStore.getState().clearUser();
    set({ isAuthenticated: false, accessToken: null, userId: null });
  },
}));
