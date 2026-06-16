import type { Request, Response } from "express";
import * as service from "./campaign.service";

export async function getCampaigns(_req: Request, res: Response) {
  res.json(await service.getActiveCampaigns());
}

export async function getCampaignById(req: Request, res: Response) {
  res.json(await service.getCampaignById(req.params.campaignId));
}

export async function createCampaign(req: Request, res: Response) {
  res.status(201).json(await service.createCampaign(req.body));
}

export async function updateCampaign(req: Request, res: Response) {
  res.json(await service.updateCampaign(req.params.campaignId, req.body));
}

export async function deleteCampaign(req: Request, res: Response) {
  res.json(await service.deleteCampaign(req.params.campaignId));
}
