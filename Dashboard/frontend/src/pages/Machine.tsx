import { useMachine } from '@/hooks/useMachine';
import { MachineStatusBadge } from '@/components/cards/MachineStatusBadge';
import { formatTime, formatTimeAgo } from '@/utils/formatters';
import { mockMachine } from '@/utils/mockData';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 min-w-[140px]">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '-'}</span>
    </div>
  );
}

export default function Machine() {
  const { data: machine, isLoading, isError } = useMachine();

  const usingDemo = isLoading || isError || !machine;
  const displayMachine = machine ?? mockMachine;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Machine Status</h1>
        {usingDemo && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-100">
            Demo data
          </span>
        )}
      </div>

      {usingDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Showing demo robot telemetry while live machine status is unavailable.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
          <img
            src="/images/edge-computing.png"
            alt="Jetson Nano edge computing module"
            className="h-56 md:h-full w-full object-cover"
          />
          <div className="p-5 flex flex-col justify-center">
            <p className="text-sm font-semibold text-gray-700">Edge AI Hardware</p>
            <p className="mt-2 text-sm text-gray-500">
              The demo robot combines on-device vision inference with an ESP32 controller for bin routing and heartbeat telemetry.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-1">Machine Info</p>
          <InfoRow label="Machine ID" value={displayMachine.machineId} />
          <InfoRow label="Name" value={displayMachine.name} />
          <InfoRow label="Location" value={displayMachine.location} />
          <InfoRow label="Edge Computer" value={displayMachine.hardware?.edgeComputer} />
          <InfoRow label="Controller" value={displayMachine.hardware?.controller} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-1">Current Status</p>
          <MachineStatusBadge state={displayMachine.currentState} lastSeenAt={displayMachine.lastSeenAt} />
          <InfoRow
            label="Last Heartbeat"
            value={displayMachine.lastSeenAt ? formatTime(displayMachine.lastSeenAt) : null}
          />
          <InfoRow
            label="Last Seen"
            value={displayMachine.lastSeenAt ? formatTimeAgo(displayMachine.lastSeenAt) : null}
          />
          <InfoRow label="Last Event ID" value={displayMachine.lastEventId} />
        </div>
      </div>

      {displayMachine.recentHeartbeats && displayMachine.recentHeartbeats.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Recent Heartbeats (last {displayMachine.recentHeartbeats.length})
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
                {displayMachine.recentHeartbeats.map((hb, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-5 text-gray-500 whitespace-nowrap">
                      {formatTime(hb.createdAt)}
                    </td>
                    <td className="py-2 px-4 font-medium">{hb.state}</td>
                    <td className="py-2 px-4 text-gray-400 font-mono text-xs">
                      {hb.lastEventId ?? '-'}
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
