import type { Request, Response } from "express";
import * as service from "./operator.service";

export async function validateVoucher(req: Request, res: Response) {
  res.json(await service.validateVoucher(req.body));
}

export async function useVoucher(req: Request, res: Response) {
  res.json(await service.useVoucher({ ...req.body, operatorId: req.user!.id }));
}

export async function getOperatorHistory(req: Request, res: Response) {
  res.json(await service.getOperatorHistory(req.user!.id));
}
