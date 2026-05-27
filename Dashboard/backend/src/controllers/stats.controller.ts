import { Request, Response } from 'express';
import { Detection } from '../models/Detection';
import type { DetectedType, TargetBin, SummaryResponse } from '../types';

// ─── GET /api/stats/summary ──────────────────────────────────────────────────
// Dashboard lấy tổng hợp thống kê (polling 5s)
export const getSummary = async (req: Request, res: Response): Promise<void> => {
  const { machineId } = req.query;

  try {
    const filter: Record<string, unknown> = {};
    if (machineId) filter.machineId = machineId;

    // TODO: Có thể aggregate trực tiếp trong MongoDB thay vì fetch all
    const [total, byTypeAgg, byBinAgg, confidenceAgg, successAgg] = await Promise.all([
      Detection.countDocuments(filter),

      // Count theo detectedType
      Detection.aggregate([
        { $match: filter },
        { $group: { _id: '$detectedType', count: { $sum: 1 } } },
      ]),

      // Count theo targetBin
      Detection.aggregate([
        { $match: filter },
        { $group: { _id: '$targetBin', count: { $sum: 1 } } },
      ]),

      // Average confidence
      Detection.aggregate([
        { $match: filter },
        { $group: { _id: null, avg: { $avg: '$confidence' } } },
      ]),

      // Success rate
      Detection.countDocuments({ ...filter, sortingStatus: 'success' }),
    ]);

    // Build byType map
    const byType = {} as Record<DetectedType, number>;
    for (const item of byTypeAgg) {
      byType[item._id as DetectedType] = item.count;
    }

    // Build byBin map
    const byBin = {} as Record<TargetBin, number>;
    for (const item of byBinAgg) {
      byBin[item._id as TargetBin] = item.count;
    }

    const summary: SummaryResponse = {
      machineId: (machineId as string) ?? 'ALL',
      total,
      byType,
      byBin,
      avgConfidence: confidenceAgg[0]?.avg ?? 0,
      successRate: total > 0 ? successAgg / total : 0,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
