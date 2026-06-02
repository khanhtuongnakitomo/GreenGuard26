import { useState } from 'react';
import { useDetections } from '@/hooks/useDetections';
import { DetectionTable } from '@/components/table/DetectionTable';
import { TableFilters } from '@/components/table/TableFilters';
import type { DetectionFilters } from '@/types';
import { mockDetections } from '@/utils/mockData';

const DEFAULT_FILTERS: DetectionFilters = {
  detectedType: '',
  sortingStatus: '',
  startDate: '',
  endDate: '',
};

const PAGE_SIZE = 20;

export default function History() {
  const [filters, setFilters] = useState<DetectionFilters>(DEFAULT_FILTERS);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, refetch } = useDetections({
    filters,
    limit: PAGE_SIZE,
    offset,
    poll: false,
  });

  const usingDemo = !data?.data?.length;
  const displayData = usingDemo ? mockDetections : data.data;
  const total = usingDemo ? mockDetections.length : data.total;
  const hasMore = offset + PAGE_SIZE < total;

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setOffset(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Detection History</h1>
          {usingDemo && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-100">
              Demo data
            </span>
          )}
        </div>
        <button
          id="history-refresh-btn"
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <TableFilters
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setOffset(0);
          }}
          onReset={handleReset}
        />
      </div>

      {isError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Cannot load backend data. Showing demo detection history.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total > 0 ? `${total} records found` : 'No records'}
            {usingDemo && <span className="ml-2 text-amber-600">(demo)</span>}
          </p>
        </div>
        <div className="p-4">
          <DetectionTable detections={displayData} loading={isLoading && !usingDemo} />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button
            id="history-prev-btn"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Prev
          </button>
          <button
            id="history-next-btn"
            disabled={!hasMore}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
