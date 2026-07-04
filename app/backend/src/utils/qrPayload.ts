import crypto from "crypto";
import { env } from "../config/env";

interface QrPayloadData {
  claimToken: string;
  totalItems: number;
  totalPoints: number;
  items: Array<{ itemType: string; quantity: number }>;
  expiresAt: string;
}

export function buildSignedQrPayload(data: QrPayloadData): string {
  const payload = JSON.stringify(data);
  const signature = crypto
    .createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(payload)
    .digest("hex");
  return JSON.stringify({ ...data, signature });
}

export function verifyQrSignature(raw: string): QrPayloadData | null {
  const parsed = JSON.parse(raw);
  const { signature, ...data } = parsed;
  const expected = crypto
    .createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");
  return signature === expected ? data : null;
}
