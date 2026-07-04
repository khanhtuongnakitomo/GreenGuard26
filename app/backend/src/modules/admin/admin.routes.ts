import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./admin.controller";
import {
  adminAdjustPointsSchema,
  campaignIdSchema,
  createCampaignSchema,
  createMilestoneSchema,
  createPartnerSchema,
  createRewardSchema,
  partnerIdSchema,
  rewardIdSchema,
  updateCampaignSchema,
  updateMilestoneSchema,
  updatePartnerSchema,
  updateRewardSchema
} from "./admin.validation";
import { analyticsQuerySchema } from "./admin.analytics.validation";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware, requireRole("admin"));

adminRoutes.get("/overview", controller.getOverview);
adminRoutes.get("/reports/contributions", controller.getContributionReport);
adminRoutes.get("/reports/rewards", controller.getRewardReport);
adminRoutes.get("/reports/users", controller.getUserReport);
adminRoutes.get("/reports/partners", controller.getPartnerReport);

adminRoutes.get("/analytics/machines", validate(analyticsQuerySchema), controller.getAnalyticsByMachine);
adminRoutes.get("/analytics/volume-trend", validate(analyticsQuerySchema), controller.getVolumeTrend);
adminRoutes.get("/analytics/trash-types", validate(analyticsQuerySchema), controller.getTrashTypeBreakdown);

adminRoutes.post("/partners", validate(createPartnerSchema), controller.createPartner);
adminRoutes.patch("/partners/:partnerId", validate(updatePartnerSchema), controller.updatePartner);
adminRoutes.delete("/partners/:partnerId", validate(partnerIdSchema), controller.deletePartner);

adminRoutes.post("/rewards", validate(createRewardSchema), controller.createReward);
adminRoutes.patch("/rewards/:rewardId", validate(updateRewardSchema), controller.updateReward);
adminRoutes.delete("/rewards/:rewardId", validate(rewardIdSchema), controller.deleteReward);

adminRoutes.post("/users/:userId/points/adjust", validate(adminAdjustPointsSchema), controller.adminAdjustPoints);

adminRoutes.post("/milestones", validate(createMilestoneSchema), controller.createMilestone);
adminRoutes.patch("/milestones/:milestoneId", validate(updateMilestoneSchema), controller.updateMilestone);

adminRoutes.post("/campaigns", validate(createCampaignSchema), controller.createCampaign);
adminRoutes.patch("/campaigns/:campaignId", validate(updateCampaignSchema), controller.updateCampaign);
adminRoutes.delete("/campaigns/:campaignId", validate(campaignIdSchema), controller.deleteCampaign);
