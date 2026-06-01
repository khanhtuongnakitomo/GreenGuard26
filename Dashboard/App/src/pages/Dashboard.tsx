import { useSummary }     from '@/hooks/useSummary';
import { useLatestEvent } from '@/hooks/useLatestEvent';
import { useDetections }  from '@/hooks/useDetections';
import { StatCard }       from '@/components/cards/StatCard';
import { LatestEvent }    from '@/components/cards/LatestEvent';
import { WasteTypeChart } from '@/components/charts/WasteTypeChart';
import { TimelineChart }  from '@/components/charts/TimelineChart';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
      ⚠️ {message} — Đang thử lại...
    </div>
  );
}

/**
 * Dashboard Overview (/) — Tổng quan trạng thái robot và thống kê.
 * Polling: summary 5s · latest 3s · detections 10s
 */
export default function Dashboard() {
  const { data: summary,    isError: sumErr }  = useSummary();
  const { data: latest }                       = useLatestEvent();
  const { data: detectionsPage, isError: detErr } = useDetections({ limit: 100 });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      {/* Error banners */}
      {sumErr && <ErrorBanner message="Không thể kết nối backend (summary)" />}
      {detErr && <ErrorBanner message="Không thể kết nối backend (detections)" />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Detections"
          value={summary?.total}
          color="text-blue-600"
        />
        <StatCard
          label="Plastic Bottles"
          value={summary?.byType?.plastic_bottle}
          color="text-green-600"
        />
        <StatCard
          label="Aluminum Cans"
          value={summary?.byType?.aluminum_can}
          color="text-orange-500"
        />
        <StatCard
          label="Avg Confidence"
          value={
            summary?.avgConfidence != null
              ? (summary.avgConfidence * 100).toFixed(1)
              : undefined
          }
          unit="%"
          color="text-purple-600"
        />
      </div>

      {/* Middle row: chart + latest event */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WasteTypeChart byType={summary?.byType ?? {}} />
        </div>
        <div>
          <LatestEvent detection={latest} />
        </div>
      </div>

      {/* Timeline */}
      <TimelineChart detections={detectionsPage?.data ?? []} />
    </div>
  );
}
