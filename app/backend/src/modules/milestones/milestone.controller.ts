import type { Request, Response } from "express";
import * as service from "./milestone.service";

export async function getMilestones(_req: Request, res: Response) {
  res.json(await service.getMilestones());
}

export async function getMyMilestones(req: Request, res: Response) {
  res.json(await service.getUserMilestoneProgress(req.user!.id));
}

export async function createMilestone(req: Request, res: Response) {
  res.status(201).json(await service.createMilestone(req.body));
}

export async function updateMilestone(req: Request, res: Response) {
  res.json(await service.updateMilestone(req.params.milestoneId, req.body));
}
