import { Request, Response } from 'express';
import { ContributionSession } from '../models/ContributionSession';
import { Machine } from '../models/Machine';

// ─── GET /api/sessions ────────────────────────────────────────────────────
// Dashboard lấy lịch sử session, hỗ trợ filter + pagination
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  const {
    machineCode,
    status,
    itemType,
    startDate,
    endDate,
    limit = '50',
    offset = '0',
  } = req.query;

  try {
    const filter: Record<string, unknown> = {};
    
    if (machineCode) {
      const machine = await Machine.findOne({ machineCode });
      if (machine) {
        filter.machineId = machine._id;
      } else {
        // If machine not found, return empty result
        res.json({ data: [], total: 0, limit: Number(limit), offset: Number(offset) });
        return;
      }
    }
    
    if (status) filter.status = status;
    if (itemType) filter['items.itemType'] = itemType;
    
    if (startDate || endDate) {
      filter.createdAt = {
        ...(startDate ? { $gte: new Date(startDate as string) } : {}),
        ...(endDate   ? { $lte: new Date(endDate as string) }   : {}),
      };
    }

    const [data, total] = await Promise.all([
      ContributionSession.find(filter)
        .populate("machineId")
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      ContributionSession.countDocuments(filter),
    ]);

    res.json({ data, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ─── GET /api/sessions/latest ─────────────────────────────────────────────
// Dashboard lấy event mới nhất (polling 3s)
export const getLatestSession = async (req: Request, res: Response): Promise<void> => {
  const { machineCode } = req.query;

  try {
    const filter: Record<string, unknown> = {};
    if (machineCode) {
        const machine = await Machine.findOne({ machineCode });
        if (machine) {
            filter.machineId = machine._id;
        } else {
            res.json(null);
            return;
        }
    }

    const latest = await ContributionSession.findOne(filter)
      .populate("machineId")
      .sort({ createdAt: -1 })
      .lean();
      
    res.json(latest ?? null);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
