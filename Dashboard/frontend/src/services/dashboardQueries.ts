import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { DEMO_MODE, fetchOverview, fetchLatestSession, fetchMachines, fetchQuality, type DashboardRange } from './api';
import { DEMO_OVERVIEW, DEMO_MACHINES, DEMO_QUALITY } from './demoData';

export const dashboardQuery = (range: DashboardRange = 'today') => queryOptions({
  queryKey: ['dashboard', 'snapshot', range, DEMO_MODE],
  queryFn: async ({ signal }) => {
    const [overview, machines, latestSession] = await Promise.all([
      fetchOverview(range, signal), fetchMachines(signal), fetchLatestSession('0001', signal),
    ]);
    return { overview, machines, latestSession };
  },
  initialData: DEMO_MODE
    ? { overview: DEMO_OVERVIEW, machines: DEMO_MACHINES, latestSession: null }
    : undefined,
  // Range changes should update only the measurements, not blank the entire
  // dashboard while the next overview response is being fetched.
  placeholderData: keepPreviousData,
  retry: false,
  // Live updates are delivered through the dashboard event stream. Polling
  // this aggregate every second causes visible loading churn in the UI.
  refetchInterval: false,
});

export const analyticsQuery = () => queryOptions({
  queryKey: ['dashboard', 'analytics', DEMO_MODE],
  queryFn: async ({ signal }) => {
    const [overview, quality] = await Promise.all([fetchOverview('today', signal), fetchQuality(signal)]);
    return { overview, quality };
  },
  initialData: DEMO_MODE ? { overview: DEMO_OVERVIEW, quality: DEMO_QUALITY } : undefined,
  retry: false,
  refetchInterval: false,
});
