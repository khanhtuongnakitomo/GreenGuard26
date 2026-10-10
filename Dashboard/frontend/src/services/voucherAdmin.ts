const API_BASE = (process.env.EXPO_PUBLIC_GREENPOINT_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export interface AdminReward {
  _id: string;
  name: string;
  description?: string;
  rewardType: string;
  pointsRequired: number;
  validUntil?: string;
  terms?: string[];
  status?: string;
  imageUrl?: string;
  partnerId: string | { _id: string; name: string };
  quantityTotal?: number;
  quantityRemaining?: number;
  deliveryType?: 'barcode';
}
export interface AdminPartner { _id: string; name: string; }
export interface RewardInput {
  partnerId: string;
  name: string;
  description: string;
  rewardType: string;
  pointsRequired: number;
  validUntil?: string;
  terms: string[];
  imageUrl?: string;
  deliveryType: 'barcode';
  status?: 'active' | 'inactive' | 'expired';
}
export interface AdminSession { accessToken: string; userId: string; displayName: string; }

export class VoucherApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export function normalizeExpiryDate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new VoucherApiError('Enter a valid expiry date in YYYY-MM-DD format.');
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new VoucherApiError('Enter a valid expiry date in YYYY-MM-DD format.');
  }
  return date.toISOString();
}

async function request<T>(path: string, token: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal,
      headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new VoucherApiError(`GreenPoint API is unavailable at ${API_BASE}. Check the API URL and server status.`);
  }
  if (!response.ok) {
    let detail = '';
    try { const body = await response.json(); detail = body.message || body.error || ''; } catch { /* response may be plain text */ }
    throw new VoucherApiError(detail || `GreenPoint request failed (${response.status}).`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const voucherAdminApi = {
  baseUrl: API_BASE,
  async login(phoneNumber: string, password: string, signal?: AbortSignal): Promise<{ accessToken: string }> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber.trim(), password }),
    }).catch((error) => {
      if ((error as Error).name === 'AbortError') throw error;
      throw new VoucherApiError(`GreenPoint API is unavailable at ${API_BASE}. Check the API URL and server status.`);
    });
    if (!response.ok) throw new VoucherApiError(response.status === 401 ? 'Phone number or password is incorrect.' : `Sign in failed (${response.status}).`, response.status);
    return response.json();
  },
  me: (token: string, signal?: AbortSignal) => request<{ _id?: string; id?: string; role: string; displayName?: string; phoneNumber?: string }>('/auth/me', token, {}, signal),
  rewards: async (token: string, signal?: AbortSignal) => {
    const rows = await request<AdminReward[]>('/admin/rewards', token, {}, signal);
    return Array.isArray(rows) ? rows : [];
  },
  partners: async (token: string, signal?: AbortSignal) => {
    const rows = await request<AdminPartner[]>('/admin/partners', token, {}, signal);
    return Array.isArray(rows) ? rows : [];
  },
  createReward: (token: string, input: RewardInput, signal?: AbortSignal) => request<AdminReward>('/admin/rewards', token, { method: 'POST', body: JSON.stringify(input) }, signal),
  updateReward: (token: string, id: string, input: RewardInput, signal?: AbortSignal) => request<AdminReward>(`/admin/rewards/${encodeURIComponent(id)}`, token, { method: 'PATCH', body: JSON.stringify(input) }, signal),
  createPartner: (token: string, name: string, signal?: AbortSignal) => request<AdminPartner>('/admin/partners', token, { method: 'POST', body: JSON.stringify({ name: name.trim(), type: 'brand' }) }, signal),
  uploadBarcode: async (token: string, rewardId: string, file: File, signal?: AbortSignal) => {
    const type = file.type.toLowerCase();
    if (!['image/png', 'image/jpeg'].includes(type)) throw new VoucherApiError('Only PNG and JPEG barcode images are accepted.');
    if (file.size > 2 * 1024 * 1024) throw new VoucherApiError('Each barcode image must be 2 MiB or smaller.');
    const response = await fetch(`${API_BASE}/admin/rewards/${encodeURIComponent(rewardId)}/barcodes`, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': type, 'X-Filename': encodeURIComponent(file.name) },
      body: file,
    }).catch((error) => {
      if ((error as Error).name === 'AbortError') throw error;
      throw new VoucherApiError(`Upload failed for ${file.name}; check the network and retry this file.`);
    });
    if (!response.ok) {
      let body: any = {};
      try { body = await response.json(); } catch { /* empty error body */ }
      const message = body.message || body.error || (response.status === 409 ? 'This barcode image is already in stock.' : `Upload failed (${response.status}).`);
      throw new VoucherApiError(message, response.status);
    }
    return response.json() as Promise<{ id: string; format: string; availableCount: number }>;
  },
};
