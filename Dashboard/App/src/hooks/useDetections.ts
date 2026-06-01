import { useQuery } from '@tanstack/react-query';
import { fetchDetections } from '@/api/client';
import { POLL_INTERVALS } from '@/utils/constants';
import type { PaginatedResponse, Detection, DetectionFilters } from '@/types';

interface UseDetectionsOptions {
  filters?: Partial<DetectionFilters>;
  limit?: number;
  offset?: number;
  /** false = không auto-poll (History page dùng refetch thủ công) */
  poll?: boolean;
}

/** Lấy lịch sử detection với filter + pagination */
export function useDetections({
  filters = {},
  limit = 50,
  offset = 0,
  poll = true,
}: UseDetectionsOptions = {}) {
  return useQuery<PaginatedResponse<Detection>>({
    queryKey:        ['detections', filters, limit, offset],
    queryFn:         () => fetchDetections({ ...filters, limit, offset }),
    refetchInterval:  poll ? POLL_INTERVALS.history : false,
    staleTime:        5_000,
    retry:            2,
  });
}
