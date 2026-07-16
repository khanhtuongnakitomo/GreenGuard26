/**
 * GreenGuard — Scan Service
 */
import api from './api';

export interface QrPayload {
  claimToken: string;
  totalItems: number;
  totalPoints: number;
  items: Array<{ itemType: string; quantity: number }>;
  expiresAt: string;
  signature: string;
  machineCode?: string;
  /** Original scanned string — required for claim fallback */
  raw?: string;
}

export interface ClaimResult {
  session: {
    _id: string;
    totalPoints: number;
    totalItems?: number;
    items: Array<{ itemType: string; quantity: number }>;
  };
  transaction: unknown;
  milestones: unknown[];
  pointsEarned: number;
  totalBalance: number;
}

export function parseQrPayload(raw: string): QrPayload | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.claimToken) return null;
    return { ...(parsed as QrPayload), raw: trimmed };
  } catch {
    // Allow raw claim token string (dev / simple QR)
    if (trimmed && trimmed.length >= 8 && !trimmed.includes('{')) {
      return {
        claimToken: trimmed,
        totalItems: 0,
        totalPoints: 0,
        items: [],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        signature: '',
        raw: trimmed,
      };
    }
    return null;
  }
}

async function claimOnce(claimToken: string, rawQr?: string): Promise<ClaimResult> {
  const body: { claimToken: string; rawQr?: string } = { claimToken };
  // Send full signed QR so backend can create the session if machine POST was missed
  if (rawQr && rawQr.startsWith('{')) {
    body.rawQr = rawQr;
  }
  const { data } = await api.post<ClaimResult>('/contributions/claim', body);
  return data;
}

export const scanService = {
  async claimContribution(claimToken: string, rawQr?: string): Promise<ClaimResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await claimOnce(claimToken, rawQr);
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        // Only retry plain 404 without rawQr race; with rawQr, 404 means real failure
        if (status === 404 && !rawQr?.startsWith('{') && attempt < 2) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  },
};
