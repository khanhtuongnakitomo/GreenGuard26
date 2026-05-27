// ─── Shared Types — dùng chung cho models, controllers, frontend ──────────────

/** Loại rác được AI phân loại */
export type DetectedType =
  | 'plastic_bottle'
  | 'aluminum_can'
  | 'paper_carton'
  | 'unknown_object';

/** Ngăn phân loại */
export type TargetBin = 'bin_1' | 'bin_2' | 'bin_3' | 'unknown_bin';

/** Command gửi ESP32 */
export type SortCommand =
  | 'SORT_BIN_1'
  | 'SORT_BIN_2'
  | 'SORT_BIN_3'
  | 'SORT_UNKNOWN';

/** Kết quả phân loại */
export type SortingStatus = 'success' | 'failed' | 'unknown';

/** Trạng thái vận hành của robot */
export type MachineState = 'IDLE' | 'SORTING' | 'SYNCING' | 'ERROR';

// ─── Detection ────────────────────────────────────────────────────────────────

/** Payload Jetson gửi lên qua POST /api/detections */
export interface CreateDetectionDto {
  eventId: string;
  machineId: string;
  deviceModel: string;
  detectedType: DetectedType;
  confidence: number;
  targetBin: TargetBin;
  sortCommand: SortCommand;
  sortingStatus: SortingStatus;
  createdAt: string; // ISO 8601 từ Jetson
}

/** Shape trả về cho dashboard (GET /api/detections) */
export interface DetectionResponse extends CreateDetectionDto {
  serverReceivedAt: string;
}

// ─── Machine ─────────────────────────────────────────────────────────────────

/** Payload Jetson gửi heartbeat */
export interface HeartbeatDto {
  machineId: string;
  state: MachineState;
  lastEventId?: string;
  createdAt: string;
}

/** Shape machine trả về dashboard */
export interface MachineResponse {
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
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Response của GET /api/stats/summary */
export interface SummaryResponse {
  machineId: string;
  total: number;
  byType: Record<DetectedType, number>;
  byBin: Record<TargetBin, number>;
  avgConfidence: number;
  successRate: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── API Generic ──────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: string[];
}
