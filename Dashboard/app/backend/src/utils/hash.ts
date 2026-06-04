import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";

export function hashOpaqueToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashOtp(otp: string) {
  return bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS);
}

export async function compareOtp(otp: string, otpHash: string) {
  return bcrypt.compare(otp, otpHash);
}

export async function hashApiKey(apiKey: string) {
  return bcrypt.hash(apiKey, env.BCRYPT_SALT_ROUNDS);
}

export async function compareApiKey(apiKey: string, apiKeyHash: string) {
  return bcrypt.compare(apiKey, apiKeyHash);
}
