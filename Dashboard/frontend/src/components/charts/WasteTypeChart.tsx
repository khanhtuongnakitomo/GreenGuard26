import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DetectedType } from '@/types';
import { formatWasteType } from '@/utils/formatters';

interface WasteTypeChartProps {
  byType: Partial<Record<DetectedType, number>>;
}

/**
 * WasteTypeChart — Bar chart số lượt phân loại theo loại rác.
 * Data: byType từ GET /api/stats/summary.
 */
export function WasteTypeChart({ byType }: WasteTypeChartProps) {
  const data = Object.entries(byType).map(([type, count]) => ({
    name:  formatWasteType(type as DetectedType),
    count: count ?? 0,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">Waste by Type</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
