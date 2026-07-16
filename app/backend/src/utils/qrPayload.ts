import crypto from "crypto";
import { env } from "../config/env";

export interface QrPayloadData {
  claimToken: string;
  totalItems: number;
  totalPoints: number;
  items: Array<{ itemType: string; quantity: number }>;
  expiresAt: string;
  machineCode?: string;
}

/**
 * Verify HMAC signed by Trash-detection (Python json.dumps separators=(',', ':')).
 * Key order must match the payload that was signed (signature field excluded).
 */
export function verifyQrSignature(raw: string): QrPayloadData | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const signature = parsed.signature;
  if (typeof signature !== "string" || !signature) return null;

  const { signature: _sig, ...data } = parsed;
  const expected = crypto
    .createHmac("sha256", env.QR_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");

  if (signature !== expected) return null;

  const claimToken = data.claimToken;
  const items = data.items;
  const expiresAt = data.expiresAt;
  if (typeof claimToken !== "string" || !Array.isArray(items) || typeof expiresAt !== "string") {
    return null;
  }

  return data as unknown as QrPayloadData;
}

export function buildSignedQrPayload(data: QrPayloadData): string {
  // Compact JSON — must match Trash-detection qr_generator.py
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", env.QR_SECRET).update(payload).digest("hex");
  return JSON.stringify({ ...data, signature });
}
