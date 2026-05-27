import { useQuery } from '@tanstack/react-query';
import { fetchLatestDetection } from '@/api/client';
import { POLL_INTERVALS } from '@/utils/constants';
import type { Detection } from '@/types';

/** Poll GET /api/detections/latest mỗi 3 giây */
export function useLatestEvent() {
  return useQuery<Detection | null>({
    queryKey:        ['latest-detection'],
    queryFn:         fetchLatestDetection,
    refetchInterval:  POLL_INTERVALS.latest,
    staleTime:        2_000,
    retry:            2,
  });
}
