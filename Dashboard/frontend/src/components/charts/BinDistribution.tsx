import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TargetBin } from '@/types';

const BIN_COLORS: Record<TargetBin, string> = {
  bin_1:       '#22c55e',
  bin_2:       '#3b82f6',
  bin_3:       '#f59e0b',
  unknown_bin: '#9ca3af',
};

interface BinDistributionProps {
  byBin: Partial<Record<TargetBin, number>>;
}

/**
 * BinDistribution — Donut/Pie chart phân bổ theo ngăn chứa.
 * Data: byBin từ GET /api/stats/summary.
 */
export function BinDistribution({ byBin }: BinDistributionProps) {
  const data = Object.entries(byBin)
    .filter(([, v]) => v && v > 0)
    .map(([bin, count]) => ({
      name:  bin,
      value: count ?? 0,
      fill:  BIN_COLORS[bin as TargetBin] ?? '#9ca3af',
    }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">Bin Distribution</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
