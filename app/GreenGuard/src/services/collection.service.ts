/**
 * GreenGuard — Collection Points Service
 */
import api from './api';
import { CollectionPoint } from '@/types/collection.types';
import { MOCK_COLLECTION_POINTS } from '@/constants/mockData';

const USE_MOCK = true;

export const collectionService = {
  async getCollectionPoints(query?: string): Promise<CollectionPoint[]> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 500));
      if (query) {
        return MOCK_COLLECTION_POINTS.filter(
          (cp) =>
            cp.name.toLowerCase().includes(query.toLowerCase()) ||
            cp.address.toLowerCase().includes(query.toLowerCase()),
        );
      }
      return MOCK_COLLECTION_POINTS;
    }
    const { data } = await api.get<CollectionPoint[]>('/collection-points', {
      params: { query },
    });
    return data;
  },

  async getCollectionPointById(id: string): Promise<CollectionPoint> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 300));
      const point = MOCK_COLLECTION_POINTS.find((cp) => cp.id === id);
      if (!point) throw new Error('Collection point not found');
      return point;
    }
    const { data } = await api.get<CollectionPoint>(`/collection-points/${id}`);
    return data;
  },
};
