import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../types/enums";
import { HttpError } from "../utils/httpError";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Insufficient permissions"));
    return next();
  };
}
