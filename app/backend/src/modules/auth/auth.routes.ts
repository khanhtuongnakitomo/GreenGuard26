import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./auth.controller";
import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  resetPasswordSchema
} from "./auth.validation";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), controller.registerUser);
authRoutes.post("/login", validate(loginSchema), controller.loginWithPassword);
authRoutes.post("/request-otp", validate(requestOtpSchema), controller.requestOtp);
authRoutes.post("/verify-otp", validate(verifyOtpSchema), controller.verifyOtp);
authRoutes.post("/refresh", validate(refreshTokenSchema), controller.refreshTokens);
authRoutes.post("/reset-password", validate(resetPasswordSchema), controller.resetPassword);
authRoutes.post("/logout", authMiddleware, controller.logout);
authRoutes.get("/me", authMiddleware, controller.getCurrentUser);
