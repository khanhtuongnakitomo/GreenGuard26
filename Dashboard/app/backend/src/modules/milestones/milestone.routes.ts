import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./milestone.controller";

export const milestoneRoutes = Router();

milestoneRoutes.get("/", controller.getMilestones);
milestoneRoutes.get("/me", authMiddleware, controller.getMyMilestones);
