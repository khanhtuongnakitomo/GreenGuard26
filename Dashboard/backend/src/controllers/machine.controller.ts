import { Request, Response } from 'express';
import { Machine } from '../models/Machine';
import { MachineHeartbeat } from '../models/MachineHeartbeat';
import type { HeartbeatDto } from '../types';

// ─── POST /api/machines/heartbeat ───────────────────────────────────────────
// Jetson gửi heartbeat định kỳ
export const receiveHeartbeat = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as HeartbeatDto;

  try {
    // Upsert machines document (currentState + lastSeenAt)
    await Machine.findOneAndUpdate(
      { machineId: body.machineId },
      {
        currentState: body.state,
        lastSeenAt:   new Date(body.createdAt),
        lastEventId:  body.lastEventId ?? null,
      },
      { upsert: true, new: true }
    );

    // Append heartbeat log
    await MachineHeartbeat.create({
      machineId:   body.machineId,
      state:       body.state,
      lastEventId: body.lastEventId ?? null,
      createdAt:   new Date(body.createdAt),
    });

    res.json({ success: true, message: 'Heartbeat recorded' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ─── GET /api/machines/:machineId ────────────────────────────────────────────
// Dashboard lấy trạng thái machine
export const getMachine = async (req: Request, res: Response): Promise<void> => {
  const { machineId } = req.params;

  try {
    const machine = await Machine.findOne({ machineId }).lean();
    if (!machine) {
      res.status(404).json({ success: false, message: `Machine ${machineId} not found` });
      return;
    }

    // Lấy 10 heartbeat gần nhất cho bảng log
    const heartbeats = await MachineHeartbeat.find({ machineId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({ ...machine, recentHeartbeats: heartbeats });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
