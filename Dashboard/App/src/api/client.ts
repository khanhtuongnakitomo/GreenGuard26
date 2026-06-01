import axios from 'axios';
import { MACHINE_ID } from '@/utils/constants';
import type {
  Detection,
  Machine,
  Summary,
  PaginatedResponse,
  DetectionFilters,
} from '@/types';

// ─── Axios instance ───────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8_000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — log errors, don't crash
api.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      console.error('[API Error]', err.message);
    }
    return Promise.reject(err);
  }
);

// ─── API functions ────────────────────────────────────────────────────────────

/** Lấy lịch sử phân loại (có filter + pagination) */
export const fetchDetections = (
  params: Partial<DetectionFilters> & { limit?: number; offset?: number } = {}
): Promise<PaginatedResponse<Detection>> =>
  api
    .get('/api/detections', { params: { machineId: MACHINE_ID, limit: 50, offset: 0, ...params } })
    .then((r) => r.data);

/** Lấy event mới nhất */
export const fetchLatestDetection = (): Promise<Detection | null> =>
  api
    .get('/api/detections/latest', { params: { machineId: MACHINE_ID } })
    .then((r) => r.data);

/** Lấy thống kê tổng quan */
export const fetchSummary = (): Promise<Summary> =>
  api
    .get('/api/stats/summary', { params: { machineId: MACHINE_ID } })
    .then((r) => r.data);

/** Lấy trạng thái machine */
export const fetchMachine = (): Promise<Machine> =>
  api
    .get(`/api/machines/${MACHINE_ID}`)
    .then((r) => r.data);
