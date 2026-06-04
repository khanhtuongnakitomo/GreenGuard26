import type { Detection } from '@/types';
import { formatTime, formatWasteType, formatConfidence } from '@/utils/formatters';

interface LatestEventProps {
  detection: Detection | null | undefined;
}

export function LatestEvent({ detection }: LatestEventProps) {
  if (!detection) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full">
        <img
          src="/images/robot-demo.png"
          alt="Smart recycling robot"
          className="h-40 w-full object-cover"
        />
        <div className="p-5 text-center text-gray-400 text-sm">No detection yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full">
      <img
        src="/images/robot-demo.png"
        alt="Smart recycling robot sorting waste"
        className="h-40 w-full object-cover"
      />
      <div className="p-5 space-y-2">
        <p className="text-sm text-gray-500 font-medium">Latest Detection</p>
        <p className="text-lg font-bold text-gray-900">{formatWasteType(detection.detectedType)}</p>
        <p className="text-sm text-gray-500">
          Confidence: <span className="font-semibold text-gray-700">{formatConfidence(detection.confidence)}</span>
        </p>
        <p className="text-sm text-gray-500">
          Bin: <span className="font-semibold text-gray-700">{detection.targetBin}</span>
        </p>
        <p className="text-xs text-gray-400 pt-1">{formatTime(detection.createdAt)}</p>
      </div>
    </div>
  );
}
