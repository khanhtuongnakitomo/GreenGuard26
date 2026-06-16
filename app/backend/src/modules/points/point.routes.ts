import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import * as controller from "./point.controller";

export const pointRoutes = Router();

pointRoutes.get("/me", authMiddleware, controller.getMyPoints);
pointRoutes.get("/me/transactions", authMiddleware, controller.getMyPointTransactions);
