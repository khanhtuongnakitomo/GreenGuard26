import { useMachine } from '@/hooks/useMachine';
import { MachineStatusBadge } from '@/components/cards/MachineStatusBadge';

/**
 * TopBar — Header chứa title và machine status badge realtime.
 */
export function TopBar() {
  const { data: machine } = useMachine();

  return (
    <header className="h-14 flex-shrink-0 border-b border-gray-100 bg-white flex items-center justify-between px-6">
      <p className="text-sm font-semibold text-gray-800">
        Smart Recycling Robot · <span className="text-blue-600">BK_BIN_01</span>
      </p>

      {machine && (
        <MachineStatusBadge
          state={machine.currentState}
          lastSeenAt={machine.lastSeenAt}
        />
      )}
    </header>
  );
}
