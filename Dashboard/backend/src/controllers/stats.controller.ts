import { materialType } from '../services/impact';
import { Request, Response } from 'express';
import ContributionSessionModel from '../models/ContributionSession';
import UserModel from '../models/User';
import MachineModel from '../models/Machine';
import type { ItemType, SummaryResponse } from '../types';

// ─── GET /api/stats/summary ──────────────────────────────────────────────────
// Dashboard lấy tổng hợp thống kê (polling 5s)
export const getSummary = async (req: Request, res: Response): Promise<void> => {
  const { machineCode } = req.query;

  try {
    let totalSessions = 0;
    let totalItems = 0;
    const byType: Partial<Record<ItemType, number>> = {
      pet_clean: 0,
      pet_bad: 0,
      aluminum: 0,
      plastic_bottle: 0,
      can: 0,
      carton: 0
    };
    let claimedSessions = 0;
    let unclaimedSessions = 0;
    let totalPointsAwarded = 0;

    if (!machineCode || machineCode === 'ALL') {
      // Global stats
      const [userTotals] = await UserModel.aggregate([
        {
          $group: {
            _id: null,
            totalPetClean: { $sum: '$totals.pet_clean' },
            totalPetBad: { $sum: '$totals.pet_bad' },
            totalAluminum: { $sum: '$totals.aluminum' },
            totalItems: { $sum: '$totalItems' }
          }
        }
      ]);

      if (userTotals) {
        byType.pet_clean = userTotals.totalPetClean || 0;
        byType.pet_bad = userTotals.totalPetBad || 0;
        byType.aluminum = userTotals.totalAluminum || 0;
        totalItems = userTotals.totalItems || 0;
      }

      totalSessions = await ContributionSessionModel.countDocuments();
      claimedSessions = await ContributionSessionModel.countDocuments({ status: 'claimed' });
      unclaimedSessions = await ContributionSessionModel.countDocuments({ status: 'unclaimed' });

      const [pointsAgg] = await ContributionSessionModel.aggregate([
        { $match: { status: 'claimed' } },
        { $group: { _id: null, total: { $sum: '$totalPoints' } } }
      ]);
      totalPointsAwarded = pointsAgg?.total || 0;

    } else {
      // Per-machine stats
      const machine = await MachineModel.findOne({ machineCode });
      if (machine) {
        const filter = { machineId: machine._id };
        
        totalSessions = await ContributionSessionModel.countDocuments(filter);
        claimedSessions = await ContributionSessionModel.countDocuments({ ...filter, status: 'claimed' });
        unclaimedSessions = await ContributionSessionModel.countDocuments({ ...filter, status: 'unclaimed' });
        
        const itemsAggs = await ContributionSessionModel.aggregate([
            { $match: filter },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.itemType",
                total: { $sum: "$items.quantity" }
            }}
        ]);

        itemsAggs.forEach(agg => {
          const type = materialType(agg._id);
          if (type) byType[type] = (byType[type] || 0) + agg.total;
        });

        totalItems = (byType.pet_clean || 0) + (byType.pet_bad || 0) + (byType.aluminum || 0);

        const [pointsAgg] = await ContributionSessionModel.aggregate([
          { $match: { ...filter, status: 'claimed' } },
          { $group: { _id: null, total: { $sum: '$totalPoints' } } }
        ]);
        totalPointsAwarded = pointsAgg?.total || 0;
      }
    }

    const summary: SummaryResponse = {
      machineCode: (machineCode as string) ?? 'ALL',
      totalSessions,
      totalItems,
      byType,
      claimedSessions,
      unclaimedSessions,
      claimRate: totalSessions > 0 ? claimedSessions / totalSessions : 0,
      totalPointsAwarded
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
