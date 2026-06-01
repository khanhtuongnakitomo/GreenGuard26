import clsx from 'clsx';
import type { MachineState } from '@/types';
import { isOnline, formatTimeAgo, machineStateLabel } from '@/utils/formatters';

const STATE_COLOR: Record<MachineState, string> = {
  IDLE:    'bg-blue-100 text-blue-700',
  SORTING: 'bg-yellow-100 text-yellow-700',
  SYNCING: 'bg-purple-100 text-purple-700',
  ERROR:   'bg-red-100 text-red-700',
};

interface MachineStatusBadgeProps {
  state: MachineState;
  lastSeenAt: string | null;
}

/**
 * MachineStatusBadge — hiện ● Online/Offline + state badge.
 * Dùng ở TopBar và Machine page.
 */
export function MachineStatusBadge({ state, lastSeenAt }: MachineStatusBadgeProps) {
  const online = isOnline(lastSeenAt);

  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          'w-2.5 h-2.5 rounded-full',
          online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        )}
      />
      <span className="text-sm font-medium text-gray-700">
        {online ? 'Online' : 'Offline'}
      </span>
      <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', STATE_COLOR[state] ?? STATE_COLOR.IDLE)}>
        {machineStateLabel[state] ?? state}
      </span>
      {lastSeenAt && (
        <span className="text-xs text-gray-400">{formatTimeAgo(lastSeenAt)}</span>
      )}
    </div>
  );
}
