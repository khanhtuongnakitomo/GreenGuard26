import { useQuery } from '@tanstack/react-query';
import { fetchSummary } from '@/api/client';
import { POLL_INTERVALS } from '@/utils/constants';
import type { Summary } from '@/types';

/** Poll GET /api/stats/summary mỗi 5 giây */
export function useSummary() {
  return useQuery<Summary>({
    queryKey:       ['summary'],
    queryFn:        fetchSummary,
    refetchInterval: POLL_INTERVALS.summary,
    staleTime:       3_000,
    retry:           2,
  });
}
