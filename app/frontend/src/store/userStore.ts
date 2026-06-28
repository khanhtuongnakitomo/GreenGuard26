/**
 * GreenGuard — Zustand User Store
 */
import { create } from 'zustand';
import { User, UserStats } from '@/types/user.types';
import { MOCK_USER_STATS } from '@/constants/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_DB_KEY = '@greenguard/users_db';

interface UserState {
  user: User | null;
  stats: UserStats | null;
  setUser: (user: User) => void;
  setStats: (stats: UserStats) => void;
  clearUser: () => void;
  loadUser: (userId: string) => Promise<boolean>;
  updateUser: (partialUser: Partial<User>) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null, // Start null to prevent showing mock user before login
  stats: MOCK_USER_STATS,

  setUser: (user) => set({ user }),
  setStats: (stats) => set({ stats }),
  clearUser: () => set({ user: null, stats: null }),

  loadUser: async (userId) => {
    const usersStr = await AsyncStorage.getItem(USERS_DB_KEY);
    if (usersStr) {
      const users = JSON.parse(usersStr);
      const found = users.find((u: any) => u.id === userId);
      if (found) {
        set({ user: found, stats: MOCK_USER_STATS });
        return true;
      }
    }
    return false;
  },

  updateUser: async (partialUser) => {
    const currentUser = get().user;
    if (!currentUser) return;
    
    const updatedUser = { ...currentUser, ...partialUser };
    set({ user: updatedUser });

    // Save back to DB
    const usersStr = await AsyncStorage.getItem(USERS_DB_KEY);
    if (usersStr) {
      const users = JSON.parse(usersStr);
      const index = users.findIndex((u: any) => u.id === currentUser.id);
      if (index !== -1) {
        users[index] = updatedUser;
        await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
      }
    }
  },
}));
