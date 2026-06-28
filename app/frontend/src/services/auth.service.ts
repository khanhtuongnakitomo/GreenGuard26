/**
 * GreenGuard — Auth Service
 * Mock-first implementation. Replace mock returns with real API calls.
 */
import api from './api';
import { AuthResponse, SignInCredentials, SignUpCredentials } from '@/types/auth.types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USE_MOCK = true; // Set to false when backend is ready
const USERS_DB_KEY = '@greenguard/users_db';

export const authService = {
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      const usersStr = await AsyncStorage.getItem(USERS_DB_KEY);
      const users = usersStr ? JSON.parse(usersStr) : [];
      const user = users.find((u: any) => u.email === credentials.email);
      
      if (!user) {
        throw new Error('Account does not exist.');
      }
      if (user.password !== credentials.password) {
        throw new Error('Incorrect password.');
      }
      
      return {
        tokens: {
          accessToken: `mock_access_token_${user.id}`,
          refreshToken: `mock_refresh_token_${user.id}`,
        },
        userId: user.id,
      };
    }
    const { data } = await api.post<AuthResponse>('/auth/sign-in', credentials);
    return data;
  },

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      const usersStr = await AsyncStorage.getItem(USERS_DB_KEY);
      const users = usersStr ? JSON.parse(usersStr) : [];
      
      const existingUser = users.find((u: any) => u.email === credentials.email);
      if (existingUser) {
        throw new Error('Email already exists. Please sign in instead.');
      }
      
      const newUser = {
        id: Math.random().toString(36).substring(2, 15),
        email: credentials.email,
        password: credentials.password, // In real app, never store plain text
        username: credentials.username,
        name: credentials.username, // Default name to username
        location: 'Earth',
        dateOfBirth: '1990-01-01',
        totalPoints: 0,
        memberTier: 'New Member',
      };
      
      users.push(newUser);
      await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
      
      return {
        tokens: {
          accessToken: '',
          refreshToken: '',
        },
        userId: newUser.id,
      };
    }
    const { data } = await api.post<AuthResponse>('/auth/sign-up', credentials);
    return data;
  },

  async signOut(): Promise<void> {
    if (USE_MOCK) return;
    await api.post('/auth/sign-out');
  },
};
