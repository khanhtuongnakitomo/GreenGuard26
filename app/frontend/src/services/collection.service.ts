/**
 * GreenGuard — Collection Points / Public Machines
 */
import api from './api';
import type { CollectionPoint, PublicMachine } from '@/types/collection.types';
import { mapMachineToCollectionPoint } from '@/utils/mappers';

export const collectionService = {
  async getCollectionPoints(query?: string): Promise<CollectionPoint[]> {
    const { data } = await api.get<PublicMachine[]>('/machines/public');
    let points = data.map((m, i) => mapMachineToCollectionPoint(m, i));

    if (query?.trim()) {
      const q = query.toLowerCase();
      points = points.filter(
        (cp) =>
          cp.name.toLowerCase().includes(q) ||
          cp.address.toLowerCase().includes(q) ||
          (cp.machineCode ?? '').toLowerCase().includes(q),
      );
    }
    return points;
  },

  async getCollectionPointById(id: string): Promise<CollectionPoint> {
    const points = await this.getCollectionPoints();
    const point = points.find((cp) => cp.id === id);
    if (!point) throw new Error('Collection point not found');
    return point;
  },
};
