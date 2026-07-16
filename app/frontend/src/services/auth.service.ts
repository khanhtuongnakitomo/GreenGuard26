/**
 * GreenGuard — Auth Service (live API)
 */
import api from './api';
import type {
  AuthResponse,
  OtpRequestResponse,
  SignInCredentials,
  SignUpCredentials,
} from '@/types/auth.types';

export const authService = {
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', {
      phoneNumber: credentials.phoneNumber.trim(),
      password: credentials.password,
    });
    return data;
  },

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      phoneNumber: credentials.phoneNumber.trim(),
      password: credentials.password,
      displayName: credentials.displayName.trim(),
      role: 'user',
    });
    return data;
  },

  async requestOtp(
    phoneNumber: string,
    purpose: 'login' | 'register' | 'reset_password' = 'login',
  ): Promise<OtpRequestResponse> {
    const { data } = await api.post<OtpRequestResponse>('/auth/request-otp', {
      phoneNumber: phoneNumber.trim(),
      purpose,
    });
    return data;
  },

  async verifyOtp(phoneNumber: string, otp: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/verify-otp', {
      phoneNumber: phoneNumber.trim(),
      otp: otp.trim(),
    });
    return data;
  },

  async resetPassword(phoneNumber: string, otp: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', {
      phoneNumber: phoneNumber.trim(),
      otp: otp.trim(),
      newPassword,
    });
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
    return data;
  },

  async me(): Promise<AuthResponse['user']> {
    const { data } = await api.get<AuthResponse['user']>('/auth/me');
    return data;
  },

  async signOut(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
  },
};
