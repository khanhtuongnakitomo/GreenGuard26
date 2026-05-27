// ─── Shared TypeScript types dùng cho cả FE ──────────────────────────────────
// (Mirror từ backend/src/types/index.ts — giữ đồng bộ thủ công hoặc dùng shared package)

export type DetectedType =
  | 'plastic_bottle'
  | 'aluminum_can'
  | 'paper_carton'
  | 'unknown_object';

export type TargetBin = 'bin_1' | 'bin_2' | 'bin_3' | 'unknown_bin';

export type SortCommand =
  | 'SORT_BIN_1'
  | 'SORT_BIN_2'
  | 'SORT_BIN_3'
  | 'SORT_UNKNOWN';

export type SortingStatus = 'success' | 'failed' | 'unknown';

export type MachineState = 'IDLE' | 'SORTING' | 'SYNCING' | 'ERROR';

// ─── Detection ───────────────────────────────────────────────────────────────

export interface Detection {
  eventId: string;
  machineId: string;
  deviceModel: string;
  detectedType: DetectedType;
  confidence: number;
  targetBin: TargetBin;
  sortCommand: SortCommand;
  sortingStatus: SortingStatus;
  createdAt: string;
  serverReceivedAt: string;
}

// ─── Machine ─────────────────────────────────────────────────────────────────

export interface MachineHeartbeatLog {
  machineId: string;
  state: MachineState;
  lastEventId: string | null;
  createdAt: string;
}

export interface Machine {
  machineId: string;
  name: string;
  location: string;
  hardware: {
    edgeComputer: string;
    controller: string;
  };
  currentState: MachineState;
  lastEventId: string | null;
  lastSeenAt: string | null;
  recentHeartbeats?: MachineHeartbeatLog[];
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface Summary {
  machineId: string;
  total: number;
  byType: Record<DetectedType, number>;
  byBin: Record<TargetBin, number>;
  avgConfidence: number;
  successRate: number;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Filter state cho History page ───────────────────────────────────────────

export interface DetectionFilters {
  detectedType: DetectedType | '';
  sortingStatus: SortingStatus | '';
  startDate: string;
  endDate: string;
}
