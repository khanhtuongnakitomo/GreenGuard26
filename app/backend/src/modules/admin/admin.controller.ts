import type { Request, Response } from "express";
import * as adminService from "./admin.service";
import * as campaignService from "../campaigns/campaign.service";
import * as milestoneService from "../milestones/milestone.service";
import * as partnerService from "../partners/partner.service";
import * as pointService from "../points/point.service";
import * as rewardService from "../rewards/reward.service";

export async function getOverview(_req: Request, res: Response) {
  res.json(await adminService.getOverview());
}

export async function getContributionReport(_req: Request, res: Response) {
  res.json(await adminService.getContributionReport());
}

export async function getRewardReport(_req: Request, res: Response) {
  res.json(await adminService.getRewardReport());
}

export async function getUserReport(_req: Request, res: Response) {
  res.json(await adminService.getUserReport());
}

export async function getPartnerReport(_req: Request, res: Response) {
  res.json(await adminService.getPartnerReport());
}

export async function createPartner(req: Request, res: Response) {
  res.status(201).json(await partnerService.createPartner(req.body));
}

export async function updatePartner(req: Request, res: Response) {
  res.json(await partnerService.updatePartner(req.params.partnerId, req.body));
}

export async function deletePartner(req: Request, res: Response) {
  res.json(await partnerService.disablePartner(req.params.partnerId));
}

export async function createReward(req: Request, res: Response) {
  res.status(201).json(await rewardService.createReward(req.body));
}

export async function updateReward(req: Request, res: Response) {
  res.json(await rewardService.updateReward(req.params.rewardId, req.body));
}

export async function deleteReward(req: Request, res: Response) {
  res.json(await rewardService.deleteReward(req.params.rewardId));
}

export async function adminAdjustPoints(req: Request, res: Response) {
  res.status(201).json(await pointService.createAdjustmentTransaction(req.params.userId, req.body.points, req.body.description));
}

export async function createMilestone(req: Request, res: Response) {
  res.status(201).json(await milestoneService.createMilestone(req.body));
}

export async function updateMilestone(req: Request, res: Response) {
  res.json(await milestoneService.updateMilestone(req.params.milestoneId, req.body));
}

export async function createCampaign(req: Request, res: Response) {
  res.status(201).json(await campaignService.createCampaign(req.body));
}

export async function updateCampaign(req: Request, res: Response) {
  res.json(await campaignService.updateCampaign(req.params.campaignId, req.body));
}

export async function deleteCampaign(req: Request, res: Response) {
  res.json(await campaignService.deleteCampaign(req.params.campaignId));
}
