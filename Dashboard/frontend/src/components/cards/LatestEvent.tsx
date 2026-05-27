import type { Detection } from '@/types';
import { formatTime, formatWasteType, formatConfidence } from '@/utils/formatters';

interface LatestEventProps {
  detection: Detection | null | undefined;
}

/**
 * LatestEvent — Card hiển thị lượt phân loại gần nhất.
 * Dùng ở Dashboard Overview, cập nhật mỗi 3 giây.
 */
export function LatestEvent({ detection }: LatestEventProps) {
  if (!detection) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-center text-gray-400 text-sm h-full">
        No detection yet
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
      <p className="text-sm text-gray-500 font-medium">Latest Detection</p>
      <p className="text-lg font-bold text-gray-900">
        {formatWasteType(detection.detectedType)}
      </p>
      <p className="text-sm text-gray-500">
        Confidence: <span className="font-semibold text-gray-700">{formatConfidence(detection.confidence)}</span>
      </p>
      <p className="text-sm text-gray-500">
        Bin: <span className="font-semibold text-gray-700">{detection.targetBin}</span>
      </p>
      <p className="text-xs text-gray-400 pt-1">{formatTime(detection.createdAt)}</p>
    </div>
  );
}
