import { ContributionSessionModel } from "../contributions/contribution.model";

export async function getContributionsByMachine(startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  return ContributionSessionModel.aggregate([
    { $match: match },
    { $group: { 
      _id: "$machineId", 
      machineName: { $first: "$machineName" },
      sessions: { $sum: 1 },
      totalItems: { $sum: "$totalItems" },
      totalPoints: { $sum: "$totalPoints" }
    }},
    { $sort: { totalItems: -1 } }
  ]);
}

export async function getCollectionVolumeTrend(period: "daily" | "weekly" | "monthly" = "daily", startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  let dateFormat = "%Y-%m-%d";
  if (period === "weekly") dateFormat = "%Y-%U";
  if (period === "monthly") dateFormat = "%Y-%m";

  return ContributionSessionModel.aggregate([
    { $match: match },
    { $group: {
      _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
      items: { $sum: "$totalItems" },
      points: { $sum: "$totalPoints" },
      sessions: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);
}

export async function getTrashTypeBreakdown(startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  return ContributionSessionModel.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $group: {
      _id: "$items.itemType",
      totalQuantity: { $sum: "$items.quantity" },
      totalPoints: { $sum: { $multiply: ["$items.quantity", "$items.pointsPerItem"] } }
    }}
  ]);
}
