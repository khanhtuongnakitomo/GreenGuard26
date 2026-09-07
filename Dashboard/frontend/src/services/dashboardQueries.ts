import { queryOptions } from '@tanstack/react-query';
import { DEMO_MODE, fetchOverview, fetchLiveFeed, fetchMachines, fetchQuality } from './api';
import { DEMO_OVERVIEW, DEMO_LIVE_FEED, DEMO_MACHINES, DEMO_QUALITY } from './demoData';

export const dashboardQuery = () => queryOptions({
  queryKey: ['dashboard', 'snapshot', DEMO_MODE],
  queryFn: async ({ signal }) => {
    const [overview, liveFeed, machines] = await Promise.all([
      fetchOverview('today', signal), fetchLiveFeed(30, signal), fetchMachines(signal),
    ]);
    return { overview, liveFeed, machines };
  },
  initialData: DEMO_MODE ? { overview: DEMO_OVERVIEW, liveFeed: DEMO_LIVE_FEED, machines: DEMO_MACHINES } : undefined,
  retry: false,
  refetchInterval: DEMO_MODE ? false : 3500,
});

export const analyticsQuery = () => queryOptions({
  queryKey: ['dashboard', 'analytics', DEMO_MODE],
  queryFn: async ({ signal }) => {
    const [overview, quality] = await Promise.all([fetchOverview('today', signal), fetchQuality(signal)]);
    return { overview, quality };
  },
  initialData: DEMO_MODE ? { overview: DEMO_OVERVIEW, quality: DEMO_QUALITY } : undefined,
  retry: false,
  refetchInterval: DEMO_MODE ? false : 4000,
});
