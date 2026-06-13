import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token";
import { HttpError } from "../utils/httpError";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}
