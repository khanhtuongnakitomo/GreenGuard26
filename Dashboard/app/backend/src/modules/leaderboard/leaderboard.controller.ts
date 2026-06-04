import type { Request, Response } from "express";
import * as service from "./leaderboard.service";

export async function getUserLeaderboard(req: Request, res: Response) {
  res.json(await service.getUserLeaderboard(req.query.period as any));
}

export async function getFacultyLeaderboard(_req: Request, res: Response) {
  res.json(await service.getFacultyLeaderboard());
}

export async function getCampaignLeaderboard(req: Request, res: Response) {
  res.json(await service.getCampaignLeaderboard(req.params.campaignId));
}
