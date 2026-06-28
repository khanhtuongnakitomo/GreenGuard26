/**
 * GreenGuard — TypeScript Types: Common
 */

export type ID = string;

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface TimeFilter {
  value: '1day' | '1month' | 'alltime';
  label: string;
}

export const TIME_FILTERS: TimeFilter[] = [
  { value: '1day', label: '1 day' },
  { value: '1month', label: '1 month' },
  { value: 'alltime', label: 'all time' },
];
