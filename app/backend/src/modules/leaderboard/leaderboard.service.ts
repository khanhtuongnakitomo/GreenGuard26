import { getDateRange, type Period } from "../../utils/dateRange";
import { PointTransactionModel } from "../points/pointTransaction.model";
import { UserModel } from "../users/user.model";

export async function getUserLeaderboard(period: Period) {
  const range = getDateRange(period);
  const match: Record<string, unknown> = { type: { $in: ["earn", "bonus"] } };
  if (range.start) match.createdAt = { $gte: range.start, $lte: range.end };

  return PointTransactionModel.aggregate([
    { $match: match },
    { $group: { _id: "$userId", points: { $sum: "$points" } } },
    { $sort: { points: -1 } },
    { $limit: 50 },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $project: { points: 1, "user.displayName": 1, "user.faculty": 1, "user.totalBottles": 1 } }
  ]);
}

export async function getFacultyLeaderboard() {
  return UserModel.aggregate([
    { $match: { role: "user" } },
    { $group: { _id: "$faculty", points: { $sum: "$lifetimeEarnedPoints" }, bottles: { $sum: "$totalBottles" } } },
    { $sort: { points: -1 } },
    { $limit: 25 }
  ]);
}

export async function getCampaignLeaderboard(campaignId: string) {
  return { campaignId, users: await getUserLeaderboard("month") };
}
