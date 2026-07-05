export type ItemType = 'plastic_bottle' | 'can' | 'carton';
export type SessionStatus = 'unclaimed' | 'claimed' | 'expired' | 'cancelled';
export type MachineStatus = 'online' | 'offline' | 'maintenance' | 'disabled';

export interface SessionItem {
  itemType: ItemType;
  quantity: number;
  pointsPerItem: number;
}

export interface SessionResponse {
  _id: string;
  sessionCode: string;
  machineId: string;
  machineName: string;
  items: SessionItem[];
  totalItems: number;
  totalPoints: number;
  status: SessionStatus;
  claimedBy?: string;
  claimedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface MachineResponse {
  _id: string;
  machineCode: string;
  name: string;
  locationName: string;
  locationType: string;
  status: MachineStatus;
  lastSeenAt: string | null;
  totalSessions: number;
  bins: Array<{ binType: string; capacityPercent: number }>;
}

export interface SummaryResponse {
  machineCode: string;       // or "ALL"
  totalSessions: number;
  totalItems: number;
  byType: Record<ItemType, number>;
  claimedSessions: number;
  unclaimedSessions: number;
  claimRate: number;
  totalPointsAwarded: number;
}

export interface SessionFilters {
  status: SessionStatus | '';
  itemType: ItemType | '';
  startDate: string;
  endDate: string;
}

export interface PaginatedResponse<T> { data: T[]; total: number; limit: number; offset: number; }
