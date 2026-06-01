import type { DetectionFilters } from '@/types';
import { WASTE_TYPES, SORTING_STATUSES } from '@/utils/constants';
import { formatWasteType } from '@/utils/formatters';

interface TableFiltersProps {
  filters: DetectionFilters;
  onChange: (filters: DetectionFilters) => void;
  onReset: () => void;
}

/**
 * TableFilters — Filter bar cho History page.
 * Controlled component: state sống ở History.tsx.
 */
export function TableFilters({ filters, onChange, onReset }: TableFiltersProps) {
  const set = <K extends keyof DetectionFilters>(key: K, value: DetectionFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Type filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Type</label>
        <select
          id="filter-type"
          value={filters.detectedType}
          onChange={(e) => set('detectedType', e.target.value as DetectionFilters['detectedType'])}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All types</option>
          {WASTE_TYPES.map((t) => (
            <option key={t} value={t}>{formatWasteType(t)}</option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Status</label>
        <select
          id="filter-status"
          value={filters.sortingStatus}
          onChange={(e) => set('sortingStatus', e.target.value as DetectionFilters['sortingStatus'])}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All statuses</option>
          {SORTING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">From</label>
        <input
          id="filter-start-date"
          type="date"
          value={filters.startDate}
          onChange={(e) => set('startDate', e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">To</label>
        <input
          id="filter-end-date"
          type="date"
          value={filters.endDate}
          onChange={(e) => set('endDate', e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Reset */}
      <button
        id="filter-reset-btn"
        onClick={onReset}
        className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Reset
      </button>
    </div>
  );
}
