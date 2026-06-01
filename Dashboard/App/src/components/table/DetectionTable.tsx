import clsx from 'clsx';
import type { Detection, SortingStatus } from '@/types';
import { formatTime, formatWasteType, formatConfidence } from '@/utils/formatters';

const STATUS_STYLE: Record<SortingStatus, string> = {
  success: 'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
};

interface DetectionTableProps {
  detections: Detection[];
  loading?: boolean;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 animate-pulse p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

/**
 * DetectionTable — Bảng lịch sử phân loại.
 * Dùng ở History page.
 */
export function DetectionTable({ detections, loading }: DetectionTableProps) {
  if (loading) return <TableSkeleton />;

  if (detections.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-8">No detections found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-100 text-gray-500">
            <th className="py-2 pr-4 font-medium">Time</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 text-right font-medium">Confidence</th>
            <th className="py-2 pr-4 font-medium">Bin</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {detections.map((d) => (
            <tr
              key={d.eventId}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                {formatTime(d.createdAt)}
              </td>
              <td className="py-2 pr-4 font-medium">{formatWasteType(d.detectedType)}</td>
              <td className="py-2 pr-4 text-right font-mono text-gray-700">
                {formatConfidence(d.confidence)}
              </td>
              <td className="py-2 pr-4 text-gray-600">{d.targetBin}</td>
              <td className="py-2">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    STATUS_STYLE[d.sortingStatus]
                  )}
                >
                  {d.sortingStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
