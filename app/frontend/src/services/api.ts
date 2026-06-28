/**
 * GreenGuard — Axios API Instance
 * All API calls route through this instance.
 * Interceptors handle auth token attachment and refresh.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { storage } from '@/utils/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.greenguard.app/v1';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    // TODO: Handle 401 → token refresh flow when backend is ready
    return Promise.reject(error);
  },
);

export default api;
