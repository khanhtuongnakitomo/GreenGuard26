/**
 * GreenGuard — TypeScript Types: Collection / Machines
 */

export interface CollectionPoint {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  locationType?: string;
  status?: string;
  machineCode?: string;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface PublicMachine {
  _id: string;
  machineCode: string;
  name: string;
  locationName: string;
  locationType: string;
  status: string;
  lastSeenAt?: string;
  latitude?: number;
  longitude?: number;
  bins?: Array<{ binType: string; capacityPercent: number }>;
}
