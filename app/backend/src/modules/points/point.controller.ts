import type { Request, Response } from "express";
import { UserModel } from "../users/user.model";
import * as service from "./point.service";

export async function getMyPoints(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id).select("totalPoints lifetimeEarnedPoints lifetimeRedeemedPoints");
  res.json(user);
}

export async function getMyPointTransactions(req: Request, res: Response) {
  res.json(await service.getMyPointTransactions(req.user!.id));
}

export async function adminAdjustPoints(req: Request, res: Response) {
  res.status(201).json(await service.createAdjustmentTransaction(req.params.userId, req.body.points, req.body.description));
}
