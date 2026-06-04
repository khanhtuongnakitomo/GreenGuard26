import { Router } from "express";
import * as controller from "./campaign.controller";

export const campaignRoutes = Router();

campaignRoutes.get("/", controller.getCampaigns);
campaignRoutes.get("/:campaignId", controller.getCampaignById);
