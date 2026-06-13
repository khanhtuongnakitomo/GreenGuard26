import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(12),
  JWT_REFRESH_SECRET: z.string().min(12),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  CLAIM_TOKEN_EXPIRES_MINUTES: z.coerce.number().default(15),
  OTP_EXPIRES_MINUTES: z.coerce.number().default(5),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = EnvSchema.parse(process.env);
