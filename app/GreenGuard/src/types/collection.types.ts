/**
 * GreenGuard — TypeScript Types: Collection
 */

export interface CollectionPoint {
  id: string;
  name: string;            // "#CocaCola1"
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColor?: string;
  address: string;         // "186 Dien Hong Ward, Ho Chi Minh City"
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}
