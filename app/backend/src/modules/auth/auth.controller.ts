import type { Request, Response } from "express";
import * as authService from "./auth.service";

export async function registerUser(req: Request, res: Response) {
  res.status(201).json(await authService.createUserWithPassword(req.body));
}

export async function loginWithPassword(req: Request, res: Response) {
  res.json(await authService.validatePasswordLogin(req.body.phoneNumber, req.body.password));
}

export async function requestOtp(req: Request, res: Response) {
  res.status(201).json(await authService.createOtp(req.body.phoneNumber, req.body.purpose));
}

export async function verifyOtp(req: Request, res: Response) {
  res.json(await authService.verifyOtpAndLogin(req.body.phoneNumber, req.body.otp));
}

export async function logout(_req: Request, res: Response) {
  res.status(204).send();
}

export async function getCurrentUser(req: Request, res: Response) {
  res.json(await authService.getCurrentUser(req.user!.id));
}
