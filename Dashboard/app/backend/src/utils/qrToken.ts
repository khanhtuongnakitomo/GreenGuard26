import { customAlphabet } from "nanoid";
import { hashOpaqueToken } from "./hash";

const readable = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

export function generateClaimToken() {
  return `GP-CLAIM-${readable()}`;
}

export function generateVoucherQrToken() {
  return `GP-VOUCHER-${readable()}`;
}

export function hashQrToken(token: string) {
  return hashOpaqueToken(normalizeScannedToken(token));
}

export function normalizeScannedToken(token: string) {
  return token.trim();
}
