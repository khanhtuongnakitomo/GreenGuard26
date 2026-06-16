import type { Request, Response } from "express";
import * as service from "./partner.service";

export async function getPartners(_req: Request, res: Response) {
  res.json(await service.getPartners());
}

export async function getPartnerById(req: Request, res: Response) {
  res.json(await service.getPartnerById(req.params.partnerId));
}

export async function createPartner(req: Request, res: Response) {
  res.status(201).json(await service.createPartner(req.body));
}

export async function updatePartner(req: Request, res: Response) {
  res.json(await service.updatePartner(req.params.partnerId, req.body));
}

export async function deletePartner(req: Request, res: Response) {
  res.json(await service.disablePartner(req.params.partnerId));
}
