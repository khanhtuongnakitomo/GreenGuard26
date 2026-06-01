import { useQuery } from '@tanstack/react-query';
import { fetchMachine } from '@/api/client';
import { POLL_INTERVALS } from '@/utils/constants';
import type { Machine } from '@/types';

/** Poll GET /api/machines/:machineId mỗi 5 giây */
export function useMachine() {
  return useQuery<Machine>({
    queryKey:        ['machine'],
    queryFn:         fetchMachine,
    refetchInterval:  POLL_INTERVALS.machine,
    staleTime:        3_000,
    retry:            2,
  });
}
