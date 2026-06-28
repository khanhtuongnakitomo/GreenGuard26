/**
 * GreenGuard — Scan Service
 */
import api from './api';

export interface QRScanResult {
  pointsEarned: number;
  collectionPointId: string;
  collectionPointName: string;
  message: string;
}

const USE_MOCK = true;

export const scanService = {
  async processQRCode(qrData: string): Promise<QRScanResult> {
    if (USE_MOCK) {
      await new Promise((res) => setTimeout(res, 1200));
      return {
        pointsEarned: 25,
        collectionPointId: 'cp_001',
        collectionPointName: '#CocaCola1',
        message: 'Successfully claimed 25 points!',
      };
    }
    const { data } = await api.post<QRScanResult>('/scan/qr', { qrData });
    return data;
  },
};
