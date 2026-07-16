import type { Request, Response } from "express";
import * as service from "./machine.service";

export async function getMachines(_req: Request, res: Response) {
  res.json(await service.getMachines());
}

export async function getPublicMachines(_req: Request, res: Response) {
  res.json(await service.getPublicMachines());
}

export async function getMachineById(req: Request, res: Response) {
  res.json(await service.getMachineById(req.params.machineId));
}

export async function createMachine(req: Request, res: Response) {
  res.status(201).json(await service.createMachine(req.body));
}

export async function updateMachine(req: Request, res: Response) {
  res.json(await service.updateMachine(req.params.machineId, req.body));
}

export async function machineHeartbeat(req: Request, res: Response) {
  res.json(await service.updateMachineHeartbeat(req.params.machineId, req.body?.bins));
}
