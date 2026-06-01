import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { Detection } from '@/types';

interface TimelineChartProps {
  /** List detection (đã sort createdAt asc) — component tự aggregate theo giờ */
  detections: Detection[];
}

/**
 * TimelineChart — Line chart số lượt phân loại theo thời gian (group by hour).
 * Data: từ GET /api/detections (limit 50+).
 */
export function TimelineChart({ detections }: TimelineChartProps) {
  // Group detections by hour
  const hourMap: Record<string, number> = {};
  for (const d of detections) {
    const hour = new Date(d.createdAt).toLocaleString('vi-VN', {
      hour:   '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    hourMap[hour] = (hourMap[hour] ?? 0) + 1;
  }

  const data = Object.entries(hourMap).map(([time, count]) => ({ time, count }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">Detection Timeline</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
