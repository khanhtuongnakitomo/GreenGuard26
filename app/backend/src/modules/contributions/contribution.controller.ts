import type { Request, Response } from "express";
import { HttpError } from "../../utils/httpError";
import * as service from "./contribution.service";

export async function createContributionSession(req: Request, res: Response) {
  const apiKey = req.header("x-machine-api-key");
  if (!apiKey) throw new HttpError(401, "Missing machine API key");
  const result = await service.createSessionFromMachine({ ...req.body, machineApiKey: apiKey });
  res.status(201).json(result);
}

export async function claimContributionSession(req: Request, res: Response) {
  res.json(
    await service.claimSessionForUser(req.user!.id, req.body.claimToken, req.body.rawQr)
  );
}

export async function getContributionSession(req: Request, res: Response) {
  res.json(await service.getContributionSession(req.params.sessionId));
}

export async function listContributions(_req: Request, res: Response) {
  res.json(await service.listContributions());
}
