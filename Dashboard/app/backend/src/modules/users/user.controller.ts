import type { Request, Response } from "express";
import * as service from "./user.service";

export async function getMe(req: Request, res: Response) {
  res.json(await service.findUserById(req.user!.id));
}

export async function updateMe(req: Request, res: Response) {
  res.json(await service.updateUserProfile(req.user!.id, req.body));
}

export async function getMySummary(req: Request, res: Response) {
  res.json(await service.getUserSummary(req.user!.id));
}

export async function getMyHistory(req: Request, res: Response) {
  res.json(await service.getUserPointHistory(req.user!.id));
}

export async function getMyImpact(req: Request, res: Response) {
  res.json(await service.getUserImpactStats(req.user!.id));
}

export async function getMyMilestones(req: Request, res: Response) {
  res.json(await service.getUserMilestoneProgress(req.user!.id));
}
