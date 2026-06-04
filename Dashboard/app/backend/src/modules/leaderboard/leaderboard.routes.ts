import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./leaderboard.controller";
import { periodQuerySchema } from "./leaderboard.validation";

export const leaderboardRoutes = Router();

leaderboardRoutes.get("/users", validate(periodQuerySchema), controller.getUserLeaderboard);
leaderboardRoutes.get("/faculties", validate(periodQuerySchema), controller.getFacultyLeaderboard);
leaderboardRoutes.get("/campaigns/:campaignId", controller.getCampaignLeaderboard);
