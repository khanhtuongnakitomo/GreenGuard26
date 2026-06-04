import { useSummary } from '@/hooks/useSummary';
import { useLatestEvent } from '@/hooks/useLatestEvent';
import { useDetections } from '@/hooks/useDetections';
import { StatCard } from '@/components/cards/StatCard';
import { LatestEvent } from '@/components/cards/LatestEvent';
import { WasteTypeChart } from '@/components/charts/WasteTypeChart';
import { TimelineChart } from '@/components/charts/TimelineChart';
import { mockDetections, mockSummary } from '@/utils/mockData';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
      {message}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isError: sumErr } = useSummary();
  const { data: latest } = useLatestEvent();
  const { data: detectionsPage, isError: detErr } = useDetections({ limit: 100 });

  const hasLiveData = Boolean(summary && summary.total > 0 && detectionsPage?.data?.length);
  const displaySummary = hasLiveData ? summary! : mockSummary;
  const displayDetections = hasLiveData ? detectionsPage?.data ?? [] : mockDetections;
  const displayLatest = latest ?? displayDetections[0];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-6 flex flex-col justify-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Overview</h1>
              {!hasLiveData && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-100">
                  Demo data
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 max-w-2xl">
              Live operating view for waste classification, confidence, bin routing, and robot heartbeat status.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl pt-2">
              <div className="rounded-lg bg-green-50 px-3 py-2">
                <p className="text-xs text-green-700">Success Rate</p>
                <p className="text-lg font-bold text-green-800">
                  {(displaySummary.successRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-xs text-blue-700">Active Robot</p>
                <p className="text-lg font-bold text-blue-800">{displaySummary.machineId}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">Last Bin</p>
                <p className="text-lg font-bold text-slate-800">{displayLatest.targetBin}</p>
              </div>
            </div>
          </div>
          <img
            src="/images/environmental-impact.png"
            alt="Environmental analytics visualization"
            className="h-56 lg:h-full w-full object-cover"
          />
        </div>
      </div>

      {sumErr && <ErrorBanner message="Cannot connect to backend summary. Showing demo data." />}
      {detErr && <ErrorBanner message="Cannot connect to backend detections. Showing demo data." />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Detections" value={displaySummary.total} color="text-blue-600" />
        <StatCard label="Plastic Bottles" value={displaySummary.byType.plastic_bottle} color="text-green-600" />
        <StatCard label="Aluminum Cans" value={displaySummary.byType.aluminum_can} color="text-orange-500" />
        <StatCard
          label="Avg Confidence"
          value={(displaySummary.avgConfidence * 100).toFixed(1)}
          unit="%"
          color="text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WasteTypeChart byType={displaySummary.byType} />
        </div>
        <LatestEvent detection={displayLatest} />
      </div>

      <TimelineChart detections={displayDetections} />
    </div>
  );
}
