import { useMachine }          from '@/hooks/useMachine';
import { MachineStatusBadge }  from '@/components/cards/MachineStatusBadge';
import { formatTime, formatTimeAgo } from '@/utils/formatters';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 min-w-[140px]">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}

/**
 * Machine page (/machine) — Trạng thái robot + heartbeat log.
 * Polling 5 giây.
 */
export default function Machine() {
  const { data: machine, isLoading, isError } = useMachine();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !machine) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
        ⚠️ Không thể tải thông tin machine — Đang thử lại...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Machine Status</h1>

      {/* Info + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Machine Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-1">Machine Info</p>
          <InfoRow label="Machine ID"    value={machine.machineId} />
          <InfoRow label="Name"          value={machine.name} />
          <InfoRow label="Location"      value={machine.location} />
          <InfoRow label="Edge Computer" value={machine.hardware?.edgeComputer} />
          <InfoRow label="Controller"    value={machine.hardware?.controller} />
        </div>

        {/* Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-1">Current Status</p>
          <MachineStatusBadge
            state={machine.currentState}
            lastSeenAt={machine.lastSeenAt}
          />
          <InfoRow
            label="Last Heartbeat"
            value={machine.lastSeenAt ? formatTime(machine.lastSeenAt) : null}
          />
          <InfoRow
            label="Last Seen"
            value={machine.lastSeenAt ? formatTimeAgo(machine.lastSeenAt) : null}
          />
          <InfoRow label="Last Event ID" value={machine.lastEventId} />
        </div>
      </div>

      {/* Heartbeat log */}
      {machine.recentHeartbeats && machine.recentHeartbeats.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Recent Heartbeats (last {machine.recentHeartbeats.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-2 px-5 font-medium">Time</th>
                  <th className="py-2 px-4 font-medium">State</th>
                  <th className="py-2 px-4 font-medium">Last Event ID</th>
                </tr>
              </thead>
              <tbody>
                {machine.recentHeartbeats.map((hb, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-5 text-gray-500 whitespace-nowrap">
                      {formatTime(hb.createdAt)}
                    </td>
                    <td className="py-2 px-4 font-medium">{hb.state}</td>
                    <td className="py-2 px-4 text-gray-400 font-mono text-xs">
                      {hb.lastEventId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
