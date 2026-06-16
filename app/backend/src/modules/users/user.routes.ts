import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./user.controller";
import { updateMeSchema } from "./user.validation";

export const userRoutes = Router();

userRoutes.use(authMiddleware);
userRoutes.get("/me", controller.getMe);
userRoutes.patch("/me", validate(updateMeSchema), controller.updateMe);
userRoutes.get("/me/summary", controller.getMySummary);
userRoutes.get("/me/history", controller.getMyHistory);
userRoutes.get("/me/impact", controller.getMyImpact);
userRoutes.get("/me/milestones", controller.getMyMilestones);
