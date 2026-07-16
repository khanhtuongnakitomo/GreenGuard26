import { z } from "zod";
import { USER_ROLES } from "../../types/enums";

export const registerSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(8),
    password: z.string().min(6).optional(),
    displayName: z.string().min(1).default("Green User"),
    role: z.enum(USER_ROLES).default("user"),
    faculty: z.string().optional(),
    studentId: z.string().optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(8),
    password: z.string().min(1)
  })
});

export const requestOtpSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(8),
    purpose: z.enum(["login", "register", "reset_password"]).default("login")
  })
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(8),
    otp: z.string().min(4).max(8)
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1)
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(8),
    otp: z.string().min(4).max(8),
    newPassword: z.string().min(6)
  })
});
