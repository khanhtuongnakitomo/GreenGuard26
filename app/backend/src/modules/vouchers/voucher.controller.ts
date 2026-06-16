import type { Request, Response } from "express";
import * as service from "./voucher.service";

export async function getMyVouchers(req: Request, res: Response) {
  res.json(await service.getUserWallet(req.user!.id));
}

export async function getVoucherDetail(req: Request, res: Response) {
  res.json(await service.getVoucherDetail(req.user!.id, req.params.voucherId));
}
