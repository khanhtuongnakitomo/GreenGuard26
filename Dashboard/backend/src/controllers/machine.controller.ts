import { Request, Response } from 'express';
import MachineModel from '../models/Machine';

// ─── GET /api/machines ────────────────────────────────────────────
// Dashboard lấy tất cả machines
export const getMachines = async (req: Request, res: Response): Promise<void> => {
  try {
    const machines = await MachineModel.find().lean();
    res.json(machines);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ─── GET /api/machines/:machineCode ────────────────────────────────────────────
// Dashboard lấy trạng thái machine
export const getMachine = async (req: Request, res: Response): Promise<void> => {
  const { machineCode } = req.params;

  try {
    const machine = await MachineModel.findOne({ machineCode }).lean();
    if (!machine) {
      res.status(404).json({ success: false, message: `Machine ${machineCode} not found` });
      return;
    }

    res.json(machine);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
