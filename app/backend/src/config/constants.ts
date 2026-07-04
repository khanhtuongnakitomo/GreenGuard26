import { env } from "./env";

export const POINT_RULES = {
  plastic_bottle: 10,
  can: 8,
  carton: 6
} as const;

export const TOKEN_EXPIRY = {
  claimMinutes: env.CLAIM_TOKEN_EXPIRES_MINUTES,
  otpMinutes: env.OTP_EXPIRES_MINUTES
};
