import { useState } from 'react';
import { useDetections }    from '@/hooks/useDetections';
import { DetectionTable }   from '@/components/table/DetectionTable';
import { TableFilters }     from '@/components/table/TableFilters';
import type { DetectionFilters } from '@/types';

const DEFAULT_FILTERS: DetectionFilters = {
  detectedType:  '',
  sortingStatus: '',
  startDate:     '',
  endDate:       '',
};

const PAGE_SIZE = 20;

/**
 * History page (/history) — Bảng lịch sử phân loại + filter + pagination.
 * Không auto-poll; user dùng manual refetch.
 */
export default function History() {
  const [filters, setFilters]  = useState<DetectionFilters>(DEFAULT_FILTERS);
  const [offset,  setOffset]   = useState(0);

  const { data, isLoading, isError, refetch } = useDetections({
    filters,
    limit:  PAGE_SIZE,
    offset,
    poll:   false, // History: manual refetch
  });

  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setOffset(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Detection History</h1>
        <button
          id="history-refresh-btn"
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <TableFilters
          filters={filters}
          onChange={(f) => { setFilters(f); setOffset(0); }}
          onReset={handleReset}
        />
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          ⚠️ Không thể tải dữ liệu — Thử lại sau.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total > 0 ? `${total} records found` : 'No records'}
          </p>
        </div>
        <div className="p-4">
          <DetectionTable detections={data?.data ?? []} loading={isLoading} />
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button
            id="history-prev-btn"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </button>
          <button
            id="history-next-btn"
            disabled={!hasMore}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
