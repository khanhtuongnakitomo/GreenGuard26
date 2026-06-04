import type { Request, Response } from "express";
import * as service from "./reward.service";

export async function getRewards(_req: Request, res: Response) {
  res.json(await service.listActiveRewards());
}

export async function getRewardById(req: Request, res: Response) {
  res.json(await service.getRewardById(req.params.rewardId));
}

export async function redeemReward(req: Request, res: Response) {
  res.status(201).json(await service.redeemRewardForUser(req.user!.id, req.params.rewardId));
}

export async function createReward(req: Request, res: Response) {
  res.status(201).json(await service.createReward(req.body));
}

export async function updateReward(req: Request, res: Response) {
  res.json(await service.updateReward(req.params.rewardId, req.body));
}

export async function deleteReward(req: Request, res: Response) {
  res.json(await service.deleteReward(req.params.rewardId));
}
