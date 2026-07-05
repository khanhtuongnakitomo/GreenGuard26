import { Request, Response } from 'express';
import { ContributionSession } from '../models/ContributionSession';
import { User } from '../models/User';
import { Machine } from '../models/Machine';
import type { ItemType, SummaryResponse } from '../types';

// ─── GET /api/stats/summary ──────────────────────────────────────────────────
// Dashboard lấy tổng hợp thống kê (polling 5s)
export const getSummary = async (req: Request, res: Response): Promise<void> => {
  const { machineCode } = req.query;

  try {
    let totalSessions = 0;
    let totalItems = 0;
    const byType: Record<ItemType, number> = {
      plastic_bottle: 0,
      can: 0,
      carton: 0
    };
    let claimedSessions = 0;
    let unclaimedSessions = 0;
    let totalPointsAwarded = 0;

    if (!machineCode || machineCode === 'ALL') {
      // Global stats
      const [userTotals] = await User.aggregate([
        {
          $group: {
            _id: null,
            totalBottles: { $sum: '$totalBottles' },
            totalCans: { $sum: '$totalCans' },
            totalCarton: { $sum: '$totalCarton' },
            totalItems: { $sum: '$totalItems' }
          }
        }
      ]);

      if (userTotals) {
        byType.plastic_bottle = userTotals.totalBottles || 0;
        byType.can = userTotals.totalCans || 0;
        byType.carton = userTotals.totalCarton || 0;
        totalItems = userTotals.totalItems || 0;
      }

      totalSessions = await ContributionSession.countDocuments();
      claimedSessions = await ContributionSession.countDocuments({ status: 'claimed' });
      unclaimedSessions = await ContributionSession.countDocuments({ status: 'unclaimed' });

      const [pointsAgg] = await ContributionSession.aggregate([
        { $match: { status: 'claimed' } },
        { $group: { _id: null, total: { $sum: '$totalPoints' } } }
      ]);
      totalPointsAwarded = pointsAgg?.total || 0;

    } else {
      // Per-machine stats
      const machine = await Machine.findOne({ machineCode });
      if (machine) {
        const filter = { machineId: machine._id };
        
        totalSessions = await ContributionSession.countDocuments(filter);
        claimedSessions = await ContributionSession.countDocuments({ ...filter, status: 'claimed' });
        unclaimedSessions = await ContributionSession.countDocuments({ ...filter, status: 'unclaimed' });
        
        const [itemsAgg] = await ContributionSession.aggregate([
            { $match: filter },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.itemType",
                total: { $sum: "$items.quantity" }
            }}
        ]);
        
        // This query actually returns an array of groups, we need to map them to byType
        const itemsAggs = await ContributionSession.aggregate([
            { $match: filter },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.itemType",
                total: { $sum: "$items.quantity" }
            }}
        ]);

        itemsAggs.forEach(agg => {
            if (agg._id === 'plastic_bottle') byType.plastic_bottle = agg.total;
            if (agg._id === 'can') byType.can = agg.total;
            if (agg._id === 'carton') byType.carton = agg.total;
        });
        
        totalItems = byType.plastic_bottle + byType.can + byType.carton;

        const [pointsAgg] = await ContributionSession.aggregate([
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
