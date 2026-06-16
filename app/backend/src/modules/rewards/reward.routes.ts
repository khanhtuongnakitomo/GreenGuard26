import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./reward.controller";
import { rewardIdSchema } from "./reward.validation";

export const rewardRoutes = Router();

rewardRoutes.get("/", controller.getRewards);
rewardRoutes.get("/:rewardId", validate(rewardIdSchema), controller.getRewardById);
rewardRoutes.post("/:rewardId/redeem", authMiddleware, validate(rewardIdSchema), controller.redeemReward);
