/**
 * GreenGuard — Axios API Instance
 * Auth token attachment + single-flight refresh on 401.
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { storage } from '@/utils/storage';
import { resolveApiBaseUrl } from '@/utils/apiUrl';

const api: AxiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function notifyRefreshWaiters(token: string | null) {
  refreshWaiters.forEach((cb) => cb(token));
  refreshWaiters = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) return null;

  const baseURL = resolveApiBaseUrl();
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    await storage.setAccessToken(data.accessToken);
    await storage.setRefreshToken(data.refreshToken);
    if (data.user?._id) {
      await storage.setUserId(String(data.user._id));
    }
    return data.accessToken as string;
  } catch {
    await storage.clearAuth();
    return null;
  }
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    config.baseURL = resolveApiBaseUrl();
    const token = await storage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/request-otp') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/reset-password')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshWaiters.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      notifyRefreshWaiters(newToken);
      if (!newToken) return Promise.reject(error);
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
export const BASE_URL = resolveApiBaseUrl();
